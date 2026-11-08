import { randomUUID } from "node:crypto";
import fsp from "node:fs/promises";
import path from "node:path";
import type { DraftPayload, RecoveredDrafts } from "../shared/contracts";

const DRAFT_EXTENSION = ".json";
const TEMP_EXTENSION = ".tmp";
const UNREADABLE_FOLDER = "unreadable";
// Old enough that no running window can still be about to rename it into place.
const STALE_TEMP_FILE_AGE_MS = 60 * 60 * 1000;
const RENAME_ATTEMPTS = 5;
const RENAME_RETRY_DELAY_MS = 50;

const pendingOperations = new Map<string, Promise<unknown>>();

// Runs operations on the same draft one at a time, in the order they were requested,
// so a slow autosave can't land after the delete that follows a save.
function runInOrder<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const previous = pendingOperations.get(key) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(operation);
  pendingOperations.set(key, next);

  const forget = () => {
    if (pendingOperations.get(key) === next) {
      pendingOperations.delete(key);
    }
  };
  next.then(forget, forget);

  return next;
}

// Draft IDs come from the page and from files on disk, and become file names, so only plain IDs are allowed.
// The app makes them with crypto.randomUUID.
const DRAFT_ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

export function isValidDraftId(draftId: unknown): draftId is string {
  return typeof draftId === "string" && DRAFT_ID_PATTERN.test(draftId);
}

function getDraftPath(directory: string, draftId: string): string {
  if (!isValidDraftId(draftId)) {
    throw new Error("That recovery draft has an invalid name.");
  }

  return path.join(directory, `${draftId}${DRAFT_EXTENSION}`);
}

function getErrorCode(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException).code;
}

// Windows refuses a rename for a moment while antivirus or the search indexer has the file open.
async function renameWithRetry(fromPath: string, toPath: string): Promise<void> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await fsp.rename(fromPath, toPath);
      return;
    } catch (error) {
      const isTemporary = ["EACCES", "EBUSY", "EPERM"].includes(getErrorCode(error) ?? "");
      if (!isTemporary || attempt === RENAME_ATTEMPTS) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, attempt * RENAME_RETRY_DELAY_MS));
    }
  }
}

// A crash during the write leaves only a temporary file, so the existing draft stays intact.
async function writeFileAtomically(filePath: string, content: string): Promise<void> {
  const tempPath = `${filePath}.${randomUUID()}${TEMP_EXTENSION}`;

  try {
    const file = await fsp.open(tempPath, "w");
    try {
      await file.writeFile(content, "utf8");
      await file.sync();
    } finally {
      await file.close();
    }

    await renameWithRetry(tempPath, filePath);
  } catch (error) {
    await fsp.rm(tempPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

export function parseDraft(rawDraft: string, entryName: string): DraftPayload | null {
  let parsed: Partial<DraftPayload> | null;
  try {
    parsed = JSON.parse(rawDraft) as Partial<DraftPayload> | null;
  } catch {
    return null;
  }

  if (typeof parsed?.content !== "string") {
    return null;
  }

  const draftId = parsed.draftId ?? path.basename(entryName, DRAFT_EXTENSION);
  if (!isValidDraftId(draftId)) {
    return null;
  }

  return {
    content: parsed.content,
    draftId,
    documentName: parsed.documentName ?? "recovered-draft.mmd",
    documentPath: typeof parsed.documentPath === "string" ? parsed.documentPath : undefined,
    theme: parsed.theme ?? "default",
    updatedAt: parsed.updatedAt ?? new Date().toISOString()
  };
}

// Keeps the damaged file for manual rescue, and stops it being reported again on every launch.
async function setAsideUnreadableDraft(directory: string, entryName: string): Promise<void> {
  const unreadableDirectory = path.join(directory, UNREADABLE_FOLDER);
  await fsp.mkdir(unreadableDirectory, { recursive: true });
  await fsp.rename(
    path.join(directory, entryName),
    path.join(unreadableDirectory, `${Date.now()}-${entryName}`)
  );
}

async function removeStaleTempFiles(directory: string, entryNames: string[]): Promise<void> {
  const oldestAllowed = Date.now() - STALE_TEMP_FILE_AGE_MS;

  await Promise.all(entryNames
    .filter((entryName) => entryName.endsWith(TEMP_EXTENSION))
    .map(async (entryName) => {
      const tempPath = path.join(directory, entryName);
      const { mtimeMs } = await fsp.stat(tempPath);
      if (mtimeMs < oldestAllowed) {
        await fsp.rm(tempPath, { force: true });
      }
    }))
    .catch(() => undefined);
}

export async function readDrafts(directory: string): Promise<RecoveredDrafts> {
  const unreadableDirectory = path.join(directory, UNREADABLE_FOLDER);
  const recovered: RecoveredDrafts = { drafts: [], unreadableCount: 0, unreadableDirectory };

  let entryNames: string[];
  try {
    entryNames = await fsp.readdir(directory);
  } catch (error) {
    if (getErrorCode(error) === "ENOENT") {
      return recovered;
    }

    throw error;
  }

  await removeStaleTempFiles(directory, entryNames);

  for (const entryName of entryNames.filter((name) => name.endsWith(DRAFT_EXTENSION)).sort()) {
    let rawDraft: string;
    try {
      rawDraft = await fsp.readFile(path.join(directory, entryName), "utf8");
    } catch {
      // The file may only be locked for now, so it stays where it is for the next launch.
      recovered.unreadableCount += 1;
      continue;
    }

    const draft = parseDraft(rawDraft, entryName);
    if (draft) {
      recovered.drafts.push(draft);
    } else {
      recovered.unreadableCount += 1;
      await setAsideUnreadableDraft(directory, entryName).catch(() => undefined);
    }
  }

  recovered.drafts.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  return recovered;
}

export function writeDraft(directory: string, draft: DraftPayload): Promise<void> {
  const draftPath = getDraftPath(directory, draft.draftId);

  return runInOrder(draftPath, async () => {
    await fsp.mkdir(directory, { recursive: true });
    await writeFileAtomically(draftPath, JSON.stringify(draft, null, 2));
  });
}

export function clearDraft(directory: string, draftId: string): Promise<void> {
  const draftPath = getDraftPath(directory, draftId);

  return runInOrder(draftPath, () => fsp.rm(draftPath, { force: true }));
}
