import fs from "node:fs";
import { fileURLToPath } from "node:url";

for (const relativePath of ["../dist/electron", "../dist/shared"]) {
  fs.rmSync(fileURLToPath(new URL(relativePath, import.meta.url)), { force: true, recursive: true });
}
