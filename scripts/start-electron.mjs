import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const electronBinary = require("electron");
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

// Some editors export this for their own Electron host, and it would make Electron run as plain Node.
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

// Matches the Linux packaging flags in package.json. Windows and macOS keep the sandbox and the GPU.
const platformFlags = process.platform === "linux"
  ? ["--no-sandbox", "--disable-gpu", "--disable-gpu-compositing", "--disable-software-rasterizer", "--in-process-gpu"]
  : [];

const child = spawn(electronBinary, [...platformFlags, ".", ...process.argv.slice(2)], {
  cwd: repoRoot,
  env,
  stdio: "inherit"
});

child.on("exit", (code, signal) => {
  process.exit(signal ? 1 : code ?? 0);
});
