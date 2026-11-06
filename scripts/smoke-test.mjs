// End-to-end smoke test for the built app, run on every supported OS in CI.
// Usage: npm run test:smoke [-- path/to/packaged/executable]
// It uses throwaway profiles and folders, and stubs native dialogs so nothing on the machine is touched.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { _electron as electron } from "playwright-core";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const packagedExecutable = process.argv[2];
const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "mermaid-tool-smoke-"));
const failures = [];
const usesRealClipboard = Boolean(process.env.CI);

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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function launchApp(userData) {
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

  await app.evaluate(({ app: electronApp, clipboard, dialog }, { documents, realClipboard }) => {
    electronApp.setPath("documents", documents);
    globalThis.nextSavePaths = [];
    globalThis.nextOpenPaths = [];
    dialog.showSaveDialog = async () => {
      const filePath = globalThis.nextSavePaths.shift();
      return filePath ? { canceled: false, filePath } : { canceled: true };
    };
    dialog.showOpenDialog = async () => {
      const filePaths = globalThis.nextOpenPaths.shift();
      return filePaths ? { canceled: false, filePaths } : { canceled: true, filePaths: [] };
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

  return { app, page: await app.firstWindow({ timeout: 60_000 }) };
}

const userData = path.join(workspace, "profile");
const drafts = path.join(userData, "drafts");
const { app, page } = await launchApp(userData);

const consoleMessages = [];
const remoteRequests = [];
const alerts = [];
page.on("console", (message) => consoleMessages.push(message.text()));
page.on("pageerror", (error) => consoleMessages.push(`pageerror: ${error}`));
page.on("request", (request) => {
  if (/^https?:/.test(request.url())) {
    remoteRequests.push(request.url());
  }
});
page.on("dialog", (dialog) => {
  if (dialog.type() === "alert") {
    alerts.push(dialog.message());
  }

  void dialog.accept().catch(() => {});
});

const queueSave = (filePath) => app.evaluate((_electron, target) => {
  globalThis.nextSavePaths.push(target);
}, filePath);
const queueOpen = (filePaths) => app.evaluate((_electron, targets) => {
  globalThis.nextOpenPaths.push(targets);
}, filePaths);
const handOverFile = (filePath) => app.evaluate(({ app: electronApp }, target) => {
  electronApp.emit("open-file", { preventDefault() {} }, target);
}, filePath);
const button = (name) => page.locator(".toolbar-main").getByRole("button", { exact: true, name });
const activeTabTitle = () => page.locator(".tabchip-active .tabchip-title").innerText();
const waitForActiveTab = (title) => page.waitForFunction(
  (expected) => document.querySelector(".tabchip-active .tabchip-title")?.textContent === expected,
  title,
  { timeout: 15_000 }
);
const waitForStatus = (fragment) => page.waitForFunction(
  (expected) => document.querySelector(".statusbar span")?.textContent.includes(expected),
  fragment,
  { timeout: 30_000 }
);

const hasEditorFocus = () => page.evaluate(() => Boolean(document.activeElement?.closest(".monaco-editor")));

// A click can land before a just-created editor has drawn, and then it doesn't take focus. No person
// is that fast, so this tries again, and logs it so a real focus problem would still be noticed.
async function focusEditorEnd() {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const box = await page.locator(".monaco-editor .view-lines").first().boundingBox();
    await page.mouse.click(box.x + 60, box.y + 12);
    if (await hasEditorFocus()) {
      break;
    }

    log(`note: editor did not take focus on click ${attempt}`);
    await sleep(250);
  }

  assert.ok(await hasEditorFocus(), "the editor never took focus");
  await page.keyboard.press(process.platform === "darwin" ? "Meta+ArrowDown" : "Control+End");
}

// Everything needed to tell apart a lost keystroke, a missing focus, and a missing draft from one log line.
const describeAppState = () => page.evaluate(() => JSON.stringify({
  activeTab: document.querySelector(".tabchip-active .tabchip-title")?.textContent,
  editor: [...document.querySelectorAll(".monaco-editor .view-line")].map((line) => line.textContent).slice(0, 4),
  focus: `${document.activeElement?.tagName}.${document.activeElement?.className}`,
  status: document.querySelector(".statusbar span")?.textContent,
  tabs: document.querySelectorAll(".tabchip-title").length
}));

function readDraftContents() {
  return fs.readdirSync(drafts)
    .filter((entry) => entry.endsWith(".json"))
    .map((entry) => JSON.parse(fs.readFileSync(path.join(drafts, entry), "utf8")).content.replace(/\r\n/g, "\n"));
}

// The draft file holds the exact text, unlike the screen, which only draws the visible lines.
async function waitForDraft(matches, timeout = 30_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const match = readDraftContents().find(matches);
    if (match !== undefined) {
      return match;
    }

    await sleep(200);
  }

  const lastLines = readDraftContents().map((content) => content.split("\n").at(-1));
  throw new Error(`no matching draft; last lines ${JSON.stringify(lastLines)}, app state ${await describeAppState()}`);
}

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

await step("app fits the window with the diagram on screen", async () => {
  await sleep(500);
  const layout = await page.evaluate(() => {
    const svg = document.querySelector(".preview-stage svg").getBoundingClientRect();
    const canvas = document.querySelector(".preview-canvas").getBoundingClientRect();
    return {
      pageHeight: document.documentElement.scrollHeight,
      visibleHeight: Math.min(svg.bottom, canvas.bottom, innerHeight) - Math.max(svg.top, canvas.top, 0),
      windowHeight: innerHeight
    };
  });
  assert.ok(layout.pageHeight <= layout.windowHeight + 1, `page is ${layout.pageHeight}px in a ${layout.windowHeight}px window`);
  assert.ok(layout.visibleHeight > 100, `only ${layout.visibleHeight}px of the diagram is visible`);
});

await step("typing updates the preview", async () => {
  await focusEditorEnd();
  await page.keyboard.type("\n    I --> Z[Smoke step]", { delay: 25 });
  await page.waitForFunction(
    () => document.querySelector(".preview-stage svg")?.textContent.includes("Smoke step"),
    null,
    { timeout: 15_000 }
  );
});

await step("recovery draft is written", async () => {
  await page.waitForFunction(() => document.querySelector(".statusbar")?.textContent.includes("Draft autosaved"), null, { timeout: 15_000 });
  assert.ok(readDraftContents().length > 0);
});

await step("autosave stops once nothing has changed", async () => {
  await sleep(1500);
  const draftFile = path.join(drafts, fs.readdirSync(drafts).find((entry) => entry.endsWith(".json")));
  const before = fs.statSync(draftFile).mtimeMs;
  await sleep(4000);
  assert.equal(fs.statSync(draftFile).mtimeMs, before);
});

await step("a second window leaves the first window's drafts alone", async () => {
  const draftsBefore = readDraftContents();
  const [secondWindow] = await Promise.all([app.waitForEvent("window"), button("Window").click()]);
  await secondWindow.locator(".monaco-editor .view-lines").first().waitFor({ state: "visible", timeout: 30_000 });
  await secondWindow.waitForFunction(() => !document.querySelector(".statusbar")?.textContent.includes("v0.0.0"), null, { timeout: 15_000 });

  const title = await secondWindow.locator(".tabchip-active .tabchip-title").innerText();
  assert.ok(!title.endsWith("*"), `second window opened with unsaved tab ${title}`);

  await secondWindow.close();
  assert.deepEqual(readDraftContents(), draftsBefore);
});

await step("failed save reports the problem and keeps the changes", async () => {
  const alertsBefore = alerts.length;
  await queueSave(path.join(workspace, "no such folder", "lost.mmd"));
  await button("Save...").click();
  await waitForStatus("Couldn't save");
  assert.equal(alerts.length, alertsBefore + 1);
  assert.ok((await activeTabTitle()).endsWith("*"));
});

await step("failed open reports the problem", async () => {
  await queueOpen([path.join(workspace, "missing.mmd")]);
  await button("Open").click();
  await waitForStatus("Couldn't open missing.mmd");
});

const savedFile = path.join(workspace, "smoke test.mmd");
await step("save writes the file", async () => {
  await queueSave(savedFile);
  await button("Save...").click();
  await waitForActiveTab("smoke test.mmd");
  assert.ok(fs.readFileSync(savedFile, "utf8").includes("Smoke step"));
});

await step("PNG export draws the labels at full size", async () => {
  const pngFile = path.join(workspace, "smoke.png");
  await queueSave(pngFile);
  await button("PNG").click();
  await waitForStatus("Exported");
  const bytes = fs.readFileSync(pngFile);
  assert.equal(bytes.subarray(1, 4).toString(), "PNG");

  // Node boxes are pale, so dark pixels inside a label's area can only be its text.
  const drawn = await page.evaluate(async (dataUrl) => {
    const image = new Image();
    image.src = dataUrl;
    await image.decode();

    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0);

    const svg = document.querySelector(".preview-stage svg");
    const svgBox = svg.getBoundingClientRect();
    const labelBox = svg.querySelector(".node .nodeLabel").getBoundingClientRect();
    const scale = image.naturalWidth / svgBox.width;
    const pixels = context.getImageData(
      (labelBox.left - svgBox.left) * scale,
      (labelBox.top - svgBox.top) * scale,
      Math.max(1, labelBox.width * scale),
      Math.max(1, labelBox.height * scale)
    ).data;

    let darkPixels = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index] + pixels[index + 1] + pixels[index + 2] < 300) {
        darkPixels += 1;
      }
    }

    const viewBoxWidth = Number(svg.getAttribute("viewBox").split(/\s+/)[2]);
    return { darkPixels, expectedWidth: Math.ceil(viewBoxWidth * 2), width: image.naturalWidth };
  }, `data:image/png;base64,${bytes.toString("base64")}`);

  assert.equal(drawn.width, drawn.expectedWidth);
  assert.ok(drawn.darkPixels > 20, `found only ${drawn.darkPixels} dark pixels where a label should be`);
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
  await waitForStatus("Copied");
  if (usesRealClipboard) {
    assert.equal(await app.evaluate(({ clipboard }) => clipboard.has("image/png")), true);
    return;
  }

  assert.deepEqual(await app.evaluate(() => globalThis.clipboardTypes), ["image/png"]);
});

await step("files handed over by the OS open in a tab", async () => {
  const handedOver = path.join(workspace, "handed over.mermaid");
  fs.writeFileSync(handedOver, "flowchart LR\n  A[Handed over] --> B[End]\n");
  await handOverFile(handedOver);
  await waitForActiveTab("handed over.mermaid");
});

await step("Enter starts a new line after a Mermaid keyword", async () => {
  await page.locator(".tabchip-add").click();
  await focusEditorEnd();
  await page.keyboard.type("flowchart TD\nA[One] --> B[Two]", { delay: 40 });
  const expected = "flowchart TD\nA[One] --> B[Two]";
  await waitForDraft((content) => content === expected, 15_000);
});

await step("typing on a large diagram keeps every character", async () => {
  const sentence = "%% the quick brown fox 0123456789";
  const edges = Array.from({ length: 300 }, (_, index) => `  N${index}[Node number ${index}] --> N${index + 1}[Node number ${index + 1}]`);
  const source = ["flowchart TD", ...edges].join("\n");
  const largeFile = path.join(workspace, "large.mmd");
  fs.writeFileSync(largeFile, source);

  await handOverFile(largeFile);
  await waitForActiveTab("large.mmd");
  await page.waitForFunction(
    () => document.querySelector(".preview-stage svg")?.textContent.includes("Node number 299"),
    null,
    { timeout: 60_000 }
  );

  await focusEditorEnd();
  await page.keyboard.press("Enter");
  await page.keyboard.type(sentence, { delay: 80 });
  await waitForDraft((content) => content.startsWith(source) && content.split("\n").at(-1).trim() === sentence, 60_000);
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

// A second launch with its own profile, because this one needs a damaged draft in place before startup.
const recoveryProfile = path.join(workspace, "recovery-profile");
const recoveryDrafts = path.join(recoveryProfile, "drafts");
fs.mkdirSync(recoveryDrafts, { recursive: true });
fs.writeFileSync(path.join(recoveryDrafts, "damaged.json"), "{ \"content\": \"cut off mid-wri");
fs.writeFileSync(path.join(recoveryDrafts, "good.json"), JSON.stringify({
  content: "flowchart LR\n  A[Recovered] --> B[End]\n",
  documentName: "good.mmd",
  draftId: "good",
  theme: "default",
  updatedAt: new Date().toISOString()
}));

const recovery = await launchApp(recoveryProfile);
await step("a damaged draft doesn't stop the others being recovered", async () => {
  await recovery.page.waitForFunction(
    () => document.querySelector(".tabchip-active .tabchip-title")?.textContent.startsWith("good.mmd"),
    null,
    { timeout: 30_000 }
  );
  await recovery.page.waitForFunction(
    () => document.querySelector(".statusbar span")?.textContent.includes("couldn't be read"),
    null,
    { timeout: 10_000 }
  );
  assert.equal(fs.existsSync(path.join(recoveryDrafts, "damaged.json")), false);
  assert.equal(fs.readdirSync(path.join(recoveryDrafts, "unreadable")).length, 1);
});
await recovery.app.close().catch(() => {});

fs.rmSync(workspace, { force: true, maxRetries: 5, recursive: true, retryDelay: 500 });

if (failures.length > 0) {
  log(`${failures.length} step(s) failed: ${failures.join(", ")}`);
  process.exit(1);
}

log("all steps passed");
process.exit(0);
