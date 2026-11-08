const REASONS_BY_CODE: Record<string, string> = {
  EACCES: "permission was denied, or the file is read-only",
  EBUSY: "another program is using the file",
  EISDIR: "that path is a folder, not a file",
  ENAMETOOLONG: "the file path is too long",
  ENOENT: "the file or folder doesn't exist",
  ENOSPC: "the disk is full",
  ENOTDIR: "part of the file path isn't a folder",
  EPERM: "permission was denied, or the file is read-only",
  EROFS: "that location is read-only"
};

// Errors crossing from the main process arrive as "Error invoking remote method 'x': Error: ...".
const REMOTE_ERROR_PREFIX = /^Error invoking remote method '[^']*':\s*(?:\w*Error:\s*)?/;

export function stripRemoteErrorPrefix(message: string): string {
  return message.replace(REMOTE_ERROR_PREFIX, "");
}

export function describeFileError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const code = message.match(/\bE[A-Z]{2,}\b/)?.[0];
  const reason = code ? REASONS_BY_CODE[code] : undefined;

  return reason ?? message.replace(REMOTE_ERROR_PREFIX, "").replace(/\.$/, "");
}
