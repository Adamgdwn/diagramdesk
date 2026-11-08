import { describe, expect, it } from "vitest";
import {
  classifyOllamaModel,
  classifyOpenAiCompatibleModel,
  parseAssistantResponse,
  resolveOllamaBaseUrl
} from "./local-models";

describe("resolveOllamaBaseUrl", () => {
  it.each([
    [undefined, "http://127.0.0.1:11434"],
    ["", "http://127.0.0.1:11434"],
    ["127.0.0.1:11434", "http://127.0.0.1:11434"],
    ["localhost", "http://localhost:11434"],
    [":11500", "http://127.0.0.1:11500"],
    ["0.0.0.0", "http://127.0.0.1:11434"],
    ["0.0.0.0:11434", "http://127.0.0.1:11434"],
    ["[::1]:11434", "http://[::1]:11434"],
    ["::", "http://[::1]:11434"],
    ["http://127.0.0.1:11434", "http://127.0.0.1:11434"],
    ["http://127.0.0.1:11434/", "http://127.0.0.1:11434"],
    ["http://gpu-box", "http://gpu-box:80"],
    ["https://models.example.com", "https://models.example.com:443"],
    ["https://models.example.com/ollama/", "https://models.example.com:443/ollama"],
    ["  gpu-box:9000  ", "http://gpu-box:9000"],
    ["gpu-box:notaport", "http://gpu-box:11434"]
  ])("reads %j as %s", (value, expected) => {
    expect(resolveOllamaBaseUrl(value)).toBe(expected);
  });
});

describe("model classification", () => {
  it("leaves out Ollama models that can't chat", () => {
    expect(classifyOllamaModel(["embedding"])).toBe("no");
    expect(classifyOllamaModel(["completion", "tools"])).toBe("yes");
    expect(classifyOllamaModel(["vision", "completion"])).toBe("yes");
  });

  it("keeps Ollama models when their capabilities aren't reported", () => {
    expect(classifyOllamaModel(undefined)).toBe("unknown");
  });

  it("only flags likely embedding models on OpenAI-style servers", () => {
    expect(classifyOpenAiCompatibleModel("text-embedding-nomic-embed-text-v1.5")).toBe("unlikely");
    expect(classifyOpenAiCompatibleModel("qwen2.5-7b-instruct")).toBe("unknown");
  });
});

describe("parseAssistantResponse", () => {
  const fallback = "flowchart TD\n  A --> B";

  it("reads a JSON reply", () => {
    expect(parseAssistantResponse(
      JSON.stringify({ assistantMessage: "Added C.", suggestedTitle: "Flow", updatedSource: "flowchart TD\n  A --> C" }),
      fallback,
      "model"
    )).toEqual({
      assistantMessage: "Added C.",
      model: "model",
      suggestedTitle: "Flow",
      updatedSource: "flowchart TD\n  A --> C"
    });
  });

  it("removes a code fence inside the diagram", () => {
    const reply = JSON.stringify({ assistantMessage: "Done.", updatedSource: "```mermaid\nflowchart TD\n  A --> C\n```" });
    expect(parseAssistantResponse(reply, fallback, "model").updatedSource).toBe("flowchart TD\n  A --> C");
  });

  it("reads JSON wrapped in a code fence and surrounded by text", () => {
    const reply = "Here you go:\n```json\n{\"assistantMessage\":\"Done.\",\"updatedSource\":\"flowchart LR\\n  X --> Y\"}\n```";
    expect(parseAssistantResponse(reply, fallback, "model").updatedSource).toBe("flowchart LR\n  X --> Y");
  });

  it("restores newlines a model escaped twice", () => {
    const reply = JSON.stringify({ assistantMessage: "Done.", updatedSource: "flowchart TD\\n  A --> C" });
    expect(parseAssistantResponse(reply, fallback, "model").updatedSource).toBe("flowchart TD\n  A --> C");
  });

  it("ignores a reasoning model's thinking", () => {
    const reply = "<think>The user wants {a node}.</think>{\"assistantMessage\":\"Done.\",\"updatedSource\":\"flowchart TD\\n  A --> C\"}";
    expect(parseAssistantResponse(reply, fallback, "model").assistantMessage).toBe("Done.");
  });

  it("treats a plain prose reply as a message with no new diagram", () => {
    const reply = "That diagram already looks right. You could add a {decision} node.";
    expect(parseAssistantResponse(reply, fallback, "model")).toEqual({
      assistantMessage: reply,
      model: "model",
      updatedSource: fallback
    });
  });

  it("keeps a fenced diagram from a prose reply as the draft", () => {
    const reply = "Try this:\n```mermaid\nflowchart TD\n  A{Ready?} --> B\n```\nIt adds a decision.";
    expect(parseAssistantResponse(reply, fallback, "model")).toEqual({
      assistantMessage: "Try this:\n\nIt adds a decision.",
      model: "model",
      updatedSource: "flowchart TD\n  A{Ready?} --> B"
    });
  });

  it("keeps the current diagram when the reply has no usable source", () => {
    const reply = JSON.stringify({ assistantMessage: "No change needed.", updatedSource: 42 });
    expect(parseAssistantResponse(reply, fallback, "model").updatedSource).toBe(fallback);
  });
});
