import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

if (process.platform !== "linux") {
  console.log("The desktop entry is Linux-only. On Windows and macOS, build an installer with npm run package:win or npm run package:mac.");
  process.exit(0);
}

const installer = fileURLToPath(new URL("./install-desktop-entry.sh", import.meta.url));
const run = spawnSync("bash", [installer], { stdio: "inherit" });
process.exit(run.status ?? 1);
