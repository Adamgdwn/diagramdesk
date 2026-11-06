import { describe, expect, it } from "vitest";
import {
  DEFAULT_DOCUMENT_NAME,
  buildExportFileName,
  countLines,
  detectDiagramType,
  ensureMermaidExtension,
  getFileNameFromPath,
  isSameDocumentPath
} from "./document";

describe("document utilities", () => {
  it("adds the Mermaid extension when none is present", () => {
    expect(ensureMermaidExtension("system-overview")).toBe("system-overview.mmd");
  });

  it("keeps an existing file extension", () => {
    expect(ensureMermaidExtension("system-overview.mermaid")).toBe("system-overview.mermaid");
  });

  it("builds export names from the current document", () => {
    expect(buildExportFileName("/tmp/ops-diagram.mmd", "svg")).toBe("ops-diagram.svg");
    expect(buildExportFileName(undefined, "png")).toBe(DEFAULT_DOCUMENT_NAME.replace(".mmd", ".png"));
  });

  it("extracts file names from local paths", () => {
    expect(getFileNameFromPath("/tmp/ops-diagram.mmd")).toBe("ops-diagram.mmd");
    expect(getFileNameFromPath("C:\\Users\\adam\\ops-diagram.mmd")).toBe("ops-diagram.mmd");
  });

  it("ignores letter case when matching paths on Windows and macOS", () => {
    expect(isSameDocumentPath("C:\\Docs\\Flow.mmd", "c:\\docs\\flow.MMD", "win32")).toBe(true);
    expect(isSameDocumentPath("/Users/adam/Flow.mmd", "/users/adam/flow.mmd", "darwin")).toBe(true);
    expect(isSameDocumentPath("/home/adam/Flow.mmd", "/home/adam/flow.mmd", "linux")).toBe(false);
  });

  it("never treats a missing path as a match", () => {
    expect(isSameDocumentPath(undefined, undefined, "win32")).toBe(false);
    expect(isSameDocumentPath("/tmp/a.mmd", undefined, "linux")).toBe(false);
  });

  it("counts lines and recognizes the diagram family", () => {
    const source = "sequenceDiagram\n  Alice->>Bob: Hello\n  Bob-->>Alice: Hi";
    expect(countLines(source)).toBe(3);
    expect(detectDiagramType(source)).toBe("Sequence");
  });
});
