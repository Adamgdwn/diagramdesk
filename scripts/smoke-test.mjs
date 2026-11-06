// End-to-end smoke test for the built app, run on every supported OS in CI.
// Usage: npm run test:smoke [-- path/to/packaged/executable]
// It uses a throwaway profile and folders, and stubs native dialogs so nothing on the machine is touched.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { _electron as electron } from "playwright-core";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const packagedExecutable = process.argv[2];
const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "mermaid-tool-smoke-"));
const userData = path.join(workspace, "profile");
const failures = [];

function log(message) {
  console.log(`[smoke] ${message}`);
}

async function step(name, action) {
  try {
    await action();
    log(`ok   ${name}`);
  } catch (error) {
    failures.push(name);
    log(`FAIL ${name}: ${String(error?.message ?? error).split("\n")[0]}`);
  }
}

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const app = await electron.launch({
  args: [
    ...(packagedExecutable ? [] : ["."]),
    `--user-data-dir=${userData}`,
    // Blocks every remote host, so the app has to work from its bundled files alone.
    "--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1",
    ...(process.platform === "linux" ? ["--no-sandbox"] : [])
  ],
  cwd: repoRoot,
  env,
  ...(packagedExecutable ? { executablePath: path.resolve(packagedExecutable) } : {}),
  timeout: 60_000
});

const usesRealClipboard = Boolean(process.env.CI);

await app.evaluate(({ app: electronApp, clipboard, dialog }, { documents, realClipboard }) => {
  electronApp.setPath("documents", documents);
  globalThis.nextSavePaths = [];
  dialog.showSaveDialog = async () => {
    const filePath = globalThis.nextSavePaths.shift();
    return filePath ? { canceled: false, filePath } : { canceled: true };
  };
  dialog.showMessageBoxSync = () => 0;
  // On a developer's machine this records what would be copied, so their clipboard is never overwritten.
  // CI has nothing to lose, so it uses the real system clipboard.
  globalThis.clipboardTypes = [];
  if (!realClipboard) {
    clipboard.write = async (items) => {
      globalThis.clipboardTypes.push(...items.flatMap((item) => item.types));
    };
  }
}, { documents: workspace, realClipboard: usesRealClipboard });

const page = await app.firstWindow({ timeout: 60_000 });
const consoleMessages = [];
const remoteRequests = [];
page.on("console", (message) => consoleMessages.push(message.text()));
page.on("pageerror", (error) => consoleMessages.push(`pageerror: ${error}`));
page.on("request", (request) => {
  if (/^https?:/.test(request.url())) {
    remoteRequests.push(request.url());
  }
});
page.on("dialog", (dialog) => void dialog.accept().catch(() => {}));

const queueSave = (filePath) => app.evaluate((_electron, target) => {
  globalThis.nextSavePaths.push(target);
}, filePath);
const button = (name) => page.locator(".toolbar-main").getByRole("button", { exact: true, name });

await step("editor loads with no network", async () => {
  await page.locator(".monaco-editor .view-lines").first().waitFor({ state: "visible", timeout: 30_000 });
});

await step("starter diagram renders", async () => {
  await page.locator(".preview-stage svg").waitFor({ timeout: 30_000 });
});

await step("no remote requests were made", async () => {
  assert.deepEqual(remoteRequests, []);
});

await step("editor worker starts", async () => {
  const problems = consoleMessages.filter((text) => /could not create web worker|falling back to loading web worker/i.test(text));
  assert.deepEqual(problems, []);
});

await step("typing updates the preview", async () => {
  const box = await page.locator(".monaco-editor .view-lines").first().boundingBox();
  await page.mouse.click(box.x + 60, box.y + 12);
  await page.keyboard.press(process.platform === "darwin" ? "Meta+ArrowDown" : "Control+End");
  await page.keyboard.type("\n    I --> Z[Smoke step]", { delay: 25 });
  await page.waitForFunction(
    () => document.querySelector(".preview-stage svg")?.textContent.includes("Smoke step"),
    null,
    { timeout: 15_000 }
  );
});

await step("recovery draft is written", async () => {
  const drafts = path.join(userData, "drafts");
  await page.waitForFunction(() => document.querySelector(".statusbar")?.textContent.includes("Draft autosaved"), null, { timeout: 15_000 });
  assert.ok(fs.readdirSync(drafts).length > 0);
});

const savedFile = path.join(workspace, "smoke test.mmd");
await step("save writes the file", async () => {
  await queueSave(savedFile);
  await button("Save...").click();
  await page.waitForFunction(() => document.querySelector(".tabchip-active .tabchip-title")?.textContent === "smoke test.mmd", null, { timeout: 10_000 });
  assert.ok(fs.readFileSync(savedFile, "utf8").includes("Smoke step"));
});

await step("PNG export writes an image", async () => {
  const pngFile = path.join(workspace, "smoke.png");
  await queueSave(pngFile);
  await button("PNG").click();
  await page.waitForFunction(() => document.querySelector(".statusbar span")?.textContent.startsWith("Exported"), null, { timeout: 30_000 });
  assert.equal(fs.readFileSync(pngFile).subarray(1, 4).toString(), "PNG");
});

await step("SVG export writes markup", async () => {
  const svgFile = path.join(workspace, "smoke.svg");
  await queueSave(svgFile);
  await button("SVG").click();
  await page.waitForFunction(() => document.querySelector(".statusbar span")?.textContent.endsWith(".svg."), null, { timeout: 30_000 });
  assert.ok(fs.readFileSync(svgFile, "utf8").startsWith("<svg"));
});

await step("Copy Image sends a PNG to the clipboard", async () => {
  await button("Copy Image").click();
  await page.waitForFunction(() => document.querySelector(".statusbar span")?.textContent.startsWith("Copied"), null, { timeout: 30_000 });
  if (usesRealClipboard) {
    assert.equal(await app.evaluate(({ clipboard }) => clipboard.has("image/png")), true);
    return;
  }

  assert.deepEqual(await app.evaluate(() => globalThis.clipboardTypes), ["image/png"]);
});

await step("files handed over by the OS open in a tab", async () => {
  const handedOver = path.join(workspace, "handed over.mermaid");
  fs.writeFileSync(handedOver, "flowchart LR\n  A[Handed over] --> B[End]\n");
  await app.evaluate(({ app: electronApp }, filePath) => {
    electronApp.emit("open-file", { preventDefault() {} }, filePath);
  }, handedOver);
  await page.waitForFunction(() => document.querySelector(".tabchip-active .tabchip-title")?.textContent === "handed over.mermaid", null, { timeout: 10_000 });
});

await step("menu fits the platform", async () => {
  const menu = await app.evaluate(({ Menu }) => Menu.getApplicationMenu().items.map((top) => ({
    label: top.label,
    role: top.role ?? null,
    items: top.submenu.items.map((item) => ({ accelerator: item.accelerator ?? null, label: item.label, role: item.role ?? null }))
  })));
  const file = menu.find((top) => top.label === "File");
  const accelerator = (label) => file.items.find((item) => item.label === label)?.accelerator;
  assert.notEqual(accelerator("Close Tab"), accelerator("Close Window"));

  const hasQuitInFile = file.items.some((item) => item.role === "quit");
  if (process.platform === "darwin") {
    assert.equal(menu[0].role, "appmenu");
    assert.equal(hasQuitInFile, false);
  } else {
    assert.equal(hasQuitInFile, true);
  }
});

await app.close().catch(() => {});
fs.rmSync(workspace, { force: true, maxRetries: 5, recursive: true, retryDelay: 500 });

if (failures.length > 0) {
  log(`${failures.length} step(s) failed: ${failures.join(", ")}`);
  process.exit(1);
}

log("all steps passed");
process.exit(0);
