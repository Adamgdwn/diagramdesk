import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor/esm/vs/editor/edcore.main.js";
import "monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution.js";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker.js?worker";

// Without this the editor wrapper downloads Monaco from a public CDN at runtime,
// which breaks offline use and runs remote code inside the app.
window.MonacoEnvironment = {
  getWorker: () => new EditorWorker()
};

loader.config({ monaco });
