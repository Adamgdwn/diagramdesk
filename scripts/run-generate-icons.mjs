import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const generator = fileURLToPath(new URL("./generate-icons.py", import.meta.url));

// The interpreter name differs by platform, and on Windows `python3` is often a Microsoft Store stub.
for (const [command, ...args] of [["python3"], ["python"], ["py", "-3"]]) {
  const probe = spawnSync(command, [...args, "--version"], { stdio: "ignore" });
  if (probe.status !== 0) {
    continue;
  }

  const run = spawnSync(command, [...args, generator], { stdio: "inherit" });
  process.exit(run.status ?? 1);
}

console.error("Python 3 is required to generate the app icons. Install it, then rerun this command.");
process.exit(1);
