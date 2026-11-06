import {
  app,
  BrowserWindow,
  ClipboardItem,
  Menu,
  clipboard,
  dialog,
  ipcMain,
  nativeImage,
  shell,
  type MenuItemConstructorOptions
} from "electron";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import type {
  AppStorageInfo,
  AssistantRequest,
  AppCommand,
  CopyImageRequest,
  DraftPayload,
  DocumentPayload,
  OpenDocumentsResult,
  SaveAssetRequest,
  SaveDocumentRequest,
  SaveResult
} from "../shared/contracts";
import { clearDraft, readDrafts, writeDraft } from "./draft-store";
import {
  generateAssistantReply,
  getAssistantRuntimeState
} from "./local-models";

const APP_NAME = "Mermaid Tool";
const APP_ID = "com.adamgoodwin.mermaidtool";
const IS_MAC = process.platform === "darwin";
const TEXT_FILE_FILTERS = [
  {
    name: "Mermaid files",
    extensions: ["mmd", "mermaid", "md", "txt"]
  }
];
const windows = new Map<number, BrowserWindow>();
const pendingLaunchDocuments = new Map<number, DocumentPayload[]>();
const queuedLaunchDocuments: DocumentPayload[] = [];
// A window joins this set once its page has asked for its launch documents, which is also the moment
// its file listener is attached. Until then documents wait in pendingLaunchDocuments so none are lost.
const windowsReadyForDocuments = new Set<number>();

// Works around GPU driver problems on Linux desktops. Windows and macOS keep hardware acceleration.
if (process.platform === "linux") {
  app.commandLine.appendSwitch("disable-gpu");
  app.commandLine.appendSwitch("disable-gpu-compositing");
  app.disableHardwareAcceleration();
}

// Groups the app's windows under its own taskbar entry instead of the generic Electron one.
if (process.platform === "win32") {
  app.setAppUserModelId(APP_ID);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isReadableFile(candidate: string): boolean {
  try {
    return fs.statSync(candidate).isFile();
  } catch {
    return false;
  }
}

function extractLaunchFile(argv: string[]): string | null {
  for (const rawArgument of argv.slice(1)) {
    if (!rawArgument || rawArgument.startsWith("--")) {
      continue;
    }

    const resolvedPath = path.resolve(rawArgument);
    if (isReadableFile(resolvedPath)) {
      return resolvedPath;
    }
  }

  return null;
}

async function readDocument(filePath: string): Promise<DocumentPayload> {
  const content = await fsp.readFile(filePath, "utf8");
  return {
    content,
    name: path.basename(filePath),
    path: filePath
  };
}

function getTargetWindow(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;
}

function getWindowFromWebContents(webContents: Electron.WebContents): BrowserWindow {
  const browserWindow = BrowserWindow.fromWebContents(webContents);
  if (!browserWindow) {
    throw new Error("The current Mermaid Tool window is not available.");
  }

  return browserWindow;
}

function sendAppCommand(command: AppCommand): void {
  const targetWindow = getTargetWindow();
  if (targetWindow) {
    targetWindow.webContents.send("app:command", command);
    return;
  }

  // macOS keeps the app and its menu alive with no windows open, so a command needs a window to land in.
  void createWindow().then((createdWindow) => {
    if (command !== "new") {
      createdWindow.webContents.send("app:command", command);
    }
  });
}

function getDraftDirectoryPath(): string {
  return path.join(app.getPath("userData"), "drafts");
}

function getDefaultSaveDirectoryPath(): string {
  return path.join(app.getPath("documents"), APP_NAME);
}

function getDefaultDocumentSavePath(request: SaveDocumentRequest): string {
  if (request.path) {
    return path.join(path.dirname(request.path), request.suggestedName);
  }

  return path.join(getDefaultSaveDirectoryPath(), request.suggestedName);
}

function getAppStorageInfo(): AppStorageInfo {
  return {
    defaultSaveDirectory: getDefaultSaveDirectoryPath(),
    draftDirectory: getDraftDirectoryPath()
  };
}

// One unreadable file shouldn't stop the others from opening, so each one reports its own result.
async function readSelectedDocuments(filePaths: string[]): Promise<OpenDocumentsResult> {
  const results = await Promise.allSettled(filePaths.map((filePath) => readDocument(filePath)));
  const opened: OpenDocumentsResult = { documents: [], failures: [] };

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      opened.documents.push(result.value);
    } else {
      opened.failures.push({
        message: getErrorMessage(result.reason),
        name: path.basename(filePaths[index])
      });
    }
  });

  return opened;
}

function buildMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    ...(IS_MAC ? [{ role: "appMenu" as const }] : []),
    {
      label: "File",
      submenu: [
        { accelerator: "CmdOrCtrl+N", click: () => sendAppCommand("new"), label: "New Tab" },
        {
          accelerator: "CmdOrCtrl+Shift+N",
          click: () => {
            void createWindow();
          },
          label: "New Window"
        },
        { accelerator: "CmdOrCtrl+O", click: () => sendAppCommand("open"), label: "Open..." },
        { accelerator: "CmdOrCtrl+S", click: () => sendAppCommand("save"), label: "Save" },
        {
          accelerator: "CmdOrCtrl+Shift+S",
          click: () => sendAppCommand("saveAs"),
          label: "Save As..."
        },
        { type: "separator" },
        { accelerator: "CmdOrCtrl+W", click: () => sendAppCommand("closeTab"), label: "Close Tab" },
        { accelerator: "CmdOrCtrl+Shift+W", role: "close", label: "Close Window" },
        { type: "separator" },
        { click: () => sendAppCommand("wipe"), label: "Wipe Editor" },
        { click: () => sendAppCommand("deleteFile"), label: "Delete File" },
        { type: "separator" },
        { click: () => sendAppCommand("exportSvg"), label: "Export SVG..." },
        { click: () => sendAppCommand("exportPng"), label: "Export PNG..." },
        // On macOS, Quit lives in the app menu.
        ...(IS_MAC
          ? []
          : [
              { type: "separator" as const },
              { role: "quit" as const, label: "Quit Mermaid Tool" }
            ])
      ]
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" }
      ]
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" }
      ]
    },
    ...(IS_MAC ? [{ role: "windowMenu" as const }] : [])
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function deliverDocument(targetWindow: BrowserWindow, document: DocumentPayload): void {
  if (windowsReadyForDocuments.has(targetWindow.id)) {
    targetWindow.webContents.send("file:opened", document);
    return;
  }

  const waiting = pendingLaunchDocuments.get(targetWindow.id) ?? [];
  pendingLaunchDocuments.set(targetWindow.id, [...waiting, document]);
}

async function dispatchOpenedDocument(filePath: string, preferredWindow?: BrowserWindow | null): Promise<void> {
  try {
    const document = await readDocument(filePath);
    const targetWindow = preferredWindow ?? getTargetWindow();
    if (targetWindow) {
      deliverDocument(targetWindow, document);
      return;
    }

    // macOS sends open-file before the app is ready on launch, and with no windows open afterwards.
    if (app.isReady()) {
      await createWindow([document]);
      return;
    }

    queuedLaunchDocuments.push(document);
  } catch (error) {
    dialog.showErrorBox(APP_NAME, `Couldn't open the requested file.\n\n${getErrorMessage(error)}`);
  }
}

async function persistTextDocument(
  browserWindow: BrowserWindow,
  request: SaveDocumentRequest,
  forceDialog: boolean
): Promise<SaveResult> {
  let destinationPath = request.path;

  if (forceDialog || !destinationPath) {
    await fsp.mkdir(path.dirname(getDefaultDocumentSavePath(request)), { recursive: true });

    const { canceled, filePath } = await dialog.showSaveDialog(browserWindow, {
      defaultPath: getDefaultDocumentSavePath(request),
      filters: TEXT_FILE_FILTERS
    });

    if (canceled || !filePath) {
      return { canceled: true };
    }

    destinationPath = filePath;
  }

  await fsp.writeFile(destinationPath, request.content, "utf8");
  return {
    canceled: false,
    path: destinationPath
  };
}

async function persistAsset(
  browserWindow: BrowserWindow,
  request: SaveAssetRequest
): Promise<SaveResult> {
  const { canceled, filePath } = await dialog.showSaveDialog(browserWindow, {
    defaultPath: path.join(app.getPath("documents"), request.suggestedName),
    filters: request.filters
  });

  if (canceled || !filePath) {
    return { canceled: true };
  }

  if (request.encoding === "base64") {
    await fsp.writeFile(filePath, Buffer.from(request.content, "base64"));
  } else {
    await fsp.writeFile(filePath, request.content, "utf8");
  }

  return {
    canceled: false,
    path: filePath
  };
}

async function copyImageToClipboard(request: CopyImageRequest): Promise<void> {
  const image = nativeImage.createFromDataURL(request.dataUrl);
  if (image.isEmpty()) {
    throw new Error("The preview image could not be copied.");
  }

  const png = new Blob([new Uint8Array(image.toPNG())], { type: "image/png" });
  await clipboard.write([new ClipboardItem({ "image/png": png })]);
}

async function deleteTextDocument(filePath: string): Promise<void> {
  await fsp.unlink(filePath);
}

async function createWindow(initialDocuments: DocumentPayload[] = []): Promise<BrowserWindow> {
  const browserWindow = new BrowserWindow({
    width: 1600,
    height: 980,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: "#f7fafc",
    title: APP_NAME,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js")
    }
  });

  const windowId = browserWindow.id;
  windows.set(windowId, browserWindow);

  // A reload replaces the page and its listener, so documents wait again until the new page asks.
  browserWindow.webContents.on("did-start-loading", () => {
    windowsReadyForDocuments.delete(windowId);
  });

  const startupDocuments = [
    ...queuedLaunchDocuments.splice(0, queuedLaunchDocuments.length),
    ...initialDocuments
  ];
  if (startupDocuments.length > 0) {
    pendingLaunchDocuments.set(windowId, startupDocuments);
  }

  browserWindow.on("closed", () => {
    windows.delete(windowId);
    pendingLaunchDocuments.delete(windowId);
    windowsReadyForDocuments.delete(windowId);
  });

  browserWindow.webContents.on("will-prevent-unload", (event) => {
    const choice = dialog.showMessageBoxSync(browserWindow, {
      buttons: ["Quit Anyway", "Keep Editing"],
      cancelId: 1,
      defaultId: 1,
      message: "You have unsaved changes.",
      detail: "Quit Mermaid Tool and discard the current unsaved edits?",
      type: "warning"
    });

    if (choice === 0) {
      event.preventDefault();
    }
  });

  await browserWindow.loadFile(path.join(__dirname, "../renderer/index.html"));

  return browserWindow;
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
}

app.setName(APP_NAME);

app.on("second-instance", (_event, argv) => {
  const launchFile = extractLaunchFile(argv);
  const targetWindow = getTargetWindow();
  if (launchFile) {
    void dispatchOpenedDocument(launchFile, targetWindow);
  }

  if (targetWindow) {
    if (targetWindow.isMinimized()) {
      targetWindow.restore();
    }

    targetWindow.focus();
  }
});

app.on("open-file", (event, filePath) => {
  event.preventDefault();
  void dispatchOpenedDocument(filePath);
});

app.whenReady().then(async () => {
  const launchDocuments: DocumentPayload[] = [];
  const launchFile = extractLaunchFile(process.argv);
  if (launchFile) {
    try {
      launchDocuments.push(await readDocument(launchFile));
    } catch (error) {
      dialog.showErrorBox(APP_NAME, `Couldn't open the requested file.\n\n${getErrorMessage(error)}`);
    }
  }

  buildMenu();
  await createWindow(launchDocuments);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.handle("app:getVersion", () => app.getVersion());

ipcMain.handle("app:getStorageInfo", () => getAppStorageInfo());

ipcMain.handle("assistant:getRuntimeState", async () => {
  return getAssistantRuntimeState();
});

ipcMain.handle("assistant:generateReply", async (_event, request: AssistantRequest) => {
  return generateAssistantReply(request);
});

ipcMain.handle("window:new", async () => {
  await createWindow();
});

ipcMain.handle("file:getLaunchDocuments", (event) => {
  const browserWindow = getWindowFromWebContents(event.sender);
  const launchDocuments = pendingLaunchDocuments.get(browserWindow.id) ?? [];
  pendingLaunchDocuments.delete(browserWindow.id);
  windowsReadyForDocuments.add(browserWindow.id);
  return launchDocuments;
});

ipcMain.handle("file:open", async (event) => {
  const browserWindow = getWindowFromWebContents(event.sender);
  await fsp.mkdir(getDefaultSaveDirectoryPath(), { recursive: true });

  const { canceled, filePaths } = await dialog.showOpenDialog(browserWindow, {
    defaultPath: getDefaultSaveDirectoryPath(),
    filters: TEXT_FILE_FILTERS,
    properties: ["multiSelections", "openFile"]
  });

  if (canceled || filePaths.length === 0) {
    return { documents: [], failures: [] };
  }

  return readSelectedDocuments(filePaths);
});

ipcMain.handle("file:delete", async (_event, filePath: string) => {
  await deleteTextDocument(filePath);
});

ipcMain.handle("file:showInFolder", async (_event, filePath: string) => {
  shell.showItemInFolder(filePath);
});

ipcMain.handle("file:save", async (_event, request: SaveDocumentRequest) => {
  return persistTextDocument(getWindowFromWebContents(_event.sender), request, false);
});

ipcMain.handle("file:saveAs", async (_event, request: SaveDocumentRequest) => {
  return persistTextDocument(getWindowFromWebContents(_event.sender), request, true);
});

ipcMain.handle("file:exportAsset", async (_event, request: SaveAssetRequest) => {
  return persistAsset(getWindowFromWebContents(_event.sender), request);
});

ipcMain.handle("clipboard:copyImage", async (_event, request: CopyImageRequest) => {
  await copyImageToClipboard(request);
});

ipcMain.handle("draft:getRecovered", async () => {
  return readDrafts(getDraftDirectoryPath());
});

ipcMain.handle("draft:save", async (_event, draft: DraftPayload) => {
  await writeDraft(getDraftDirectoryPath(), draft);
});

ipcMain.handle("draft:clear", async (_event, draftId: string) => {
  await clearDraft(getDraftDirectoryPath(), draftId);
});
