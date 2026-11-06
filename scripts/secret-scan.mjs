import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const PATTERNS = [
  ["AWS access key", /AKIA[0-9A-Z]{16}/],
  ["GitHub token", /ghp_[A-Za-z0-9]{36,}/],
  ["GitHub fine-grained token", /github_pat_[A-Za-z0-9_]{20,}/],
  ["API key", /sk-[A-Za-z0-9]{20,}/],
  ["Private key", /-----BEGIN (RSA|EC|OPENSSH|DSA|PGP) PRIVATE KEY-----/]
];
const EXCLUDED_DIRECTORIES = new Set([".git", "dist", "node_modules", "release"]);

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      return EXCLUDED_DIRECTORIES.has(entry.name) ? [] : walk(path.join(directory, entry.name));
    }

    return entry.isFile() ? [path.join(directory, entry.name)] : [];
  });
}

// Follows .gitignore where it can, so ignored output is skipped and untracked files are still checked.
function listFiles(root) {
  const git = spawnSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024
  });

  if (git.status !== 0) {
    return walk(root);
  }

  return git.stdout.split("\0").filter(Boolean).map((file) => path.join(root, file));
}

const root = path.resolve(process.argv[2] ?? process.cwd());
const findings = [];

for (const file of listFiles(root)) {
  let contents;
  try {
    contents = fs.readFileSync(file);
  } catch {
    continue;
  }

  if (contents.subarray(0, 8000).includes(0)) {
    continue;
  }

  contents.toString("utf8").split(/\r?\n/).forEach((line, index) => {
    for (const [label, pattern] of PATTERNS) {
      if (pattern.test(line)) {
        findings.push(`${path.relative(root, file)}:${index + 1}  ${label}`);
      }
    }
  });
}

if (findings.length > 0) {
  // The matching text is left out on purpose so a real secret never lands in a terminal or CI log.
  console.error(`Potential secrets found:\n${findings.join("\n")}`);
  process.exit(1);
}

console.log("Secret scan passed.");
