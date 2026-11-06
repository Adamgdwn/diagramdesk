import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DraftPayload } from "../shared/contracts";
import { clearDraft, parseDraft, readDrafts, writeDraft } from "./draft-store";

function buildDraft(draftId: string, content = "flowchart TD\n  A --> B"): DraftPayload {
  return {
    content,
    documentName: `${draftId}.mmd`,
    draftId,
    theme: "default",
    updatedAt: "2026-11-06T12:00:00.000Z"
  };
}

describe("draft store", () => {
  let directory: string;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "diagramdesk-drafts-"));
  });

  afterEach(() => {
    fs.rmSync(directory, { force: true, recursive: true });
  });

  it("reads back what it wrote and leaves no temporary files", async () => {
    await writeDraft(directory, buildDraft("one"));

    const { drafts, unreadableCount } = await readDrafts(directory);

    expect(drafts.map((draft) => draft.draftId)).toEqual(["one"]);
    expect(unreadableCount).toBe(0);
    expect(fs.readdirSync(directory)).toEqual(["one.json"]);
  });

  it("returns nothing when the folder doesn't exist yet", async () => {
    const { drafts, unreadableCount } = await readDrafts(path.join(directory, "missing"));

    expect(drafts).toEqual([]);
    expect(unreadableCount).toBe(0);
  });

  it("recovers good drafts and sets a damaged one aside", async () => {
    await writeDraft(directory, buildDraft("good"));
    fs.writeFileSync(path.join(directory, "damaged.json"), "{ \"content\": \"cut off mid-wri");
    fs.writeFileSync(path.join(directory, "empty.json"), "");

    const first = await readDrafts(directory);

    expect(first.drafts.map((draft) => draft.draftId)).toEqual(["good"]);
    expect(first.unreadableCount).toBe(2);
    expect(fs.readdirSync(first.unreadableDirectory)).toHaveLength(2);

    const second = await readDrafts(directory);
    expect(second.drafts.map((draft) => draft.draftId)).toEqual(["good"]);
    expect(second.unreadableCount).toBe(0);
  });

  it("keeps the previous draft when a leftover temporary file exists", async () => {
    await writeDraft(directory, buildDraft("kept", "original"));
    fs.writeFileSync(path.join(directory, "kept.json.abc.tmp"), "{ \"content\": \"half writ");

    const { drafts, unreadableCount } = await readDrafts(directory);

    expect(drafts[0].content).toBe("original");
    expect(unreadableCount).toBe(0);
  });

  it("removes abandoned temporary files but not recent ones", async () => {
    const abandoned = path.join(directory, "a.json.old.tmp");
    const recent = path.join(directory, "a.json.new.tmp");
    fs.writeFileSync(abandoned, "x");
    fs.writeFileSync(recent, "x");
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    fs.utimesSync(abandoned, twoHoursAgo, twoHoursAgo);

    await readDrafts(directory);

    expect(fs.existsSync(abandoned)).toBe(false);
    expect(fs.existsSync(recent)).toBe(true);
  });

  it("applies overlapping writes and a delete in the order requested", async () => {
    const operations = [
      writeDraft(directory, buildDraft("ordered", "first")),
      writeDraft(directory, buildDraft("ordered", "second")),
      clearDraft(directory, "ordered")
    ];

    await Promise.all(operations);

    expect(fs.readdirSync(directory)).toEqual([]);
  });

  it("clears a draft that is already gone without complaint", async () => {
    await expect(clearDraft(directory, "never-existed")).resolves.toBeUndefined();
  });
});

describe("parseDraft", () => {
  it("rejects anything that isn't a draft", () => {
    expect(parseDraft("not json", "a.json")).toBeNull();
    expect(parseDraft("null", "a.json")).toBeNull();
    expect(parseDraft("[1, 2]", "a.json")).toBeNull();
    expect(parseDraft("{\"content\": 5}", "a.json")).toBeNull();
    expect(parseDraft("{\"documentName\": \"a.mmd\"}", "a.json")).toBeNull();
  });

  it("fills in optional fields from a minimal draft", () => {
    const draft = parseDraft("{\"content\": \"\"}", "abc.json");

    expect(draft).toMatchObject({
      content: "",
      documentName: "recovered-draft.mmd",
      draftId: "abc",
      theme: "default"
    });
  });
});
