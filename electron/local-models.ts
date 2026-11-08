import type {
  AssistantRequest,
  AssistantResponse,
  AssistantRuntimeState,
  ChatSupport,
  LocalModelInfo,
  LocalRuntimeInfo,
  LocalRuntimeKind
} from "../shared/contracts";

const ASSISTANT_TIMEOUT_MS = 120_000;
// Listing models should be quick. A port that accepts the connection but never answers mustn't hold up the panel.
const PROBE_TIMEOUT_MS = 10_000;
const DEFAULT_ASSISTANT_MESSAGE = "I drafted an updated Mermaid diagram for you.";
const REPLY_SCHEMA = {
  additionalProperties: false,
  properties: {
    assistantMessage: { type: "string" },
    suggestedTitle: { type: "string" },
    updatedSource: { type: "string" }
  },
  required: ["assistantMessage", "updatedSource"],
  type: "object"
};

type RuntimeCandidate = {
  baseUrl: string;
  id: string;
  kind: LocalRuntimeKind;
  label: string;
  priority: number;
};

type ReachableRuntime = RuntimeCandidate & {
  models: LocalModelInfo[];
};

function normalizeBaseUrl(rawBaseUrl: string): string {
  return rawBaseUrl.trim().replace(/\/$/, "");
}

function splitHostAndPort(hostPort: string): { host: string; port?: string } {
  const bracketed = hostPort.match(/^\[([^\]]*)\](?::(\d*))?$/);
  if (bracketed) {
    return { host: bracketed[1] ?? "", port: bracketed[2] || undefined };
  }

  const colonCount = hostPort.split(":").length - 1;
  if (colonCount === 1) {
    const [host, port] = hostPort.split(":");
    return { host: host ?? "", port: port || undefined };
  }

  // No colon is a bare host. More than one is a bare IPv6 address, which can't carry a port without brackets.
  return { host: hostPort };
}

// Reads OLLAMA_HOST the way Ollama itself does: the scheme defaults to http, and the port to 11434,
// or to 80 or 443 when a scheme is given without one. So "127.0.0.1:11434", "localhost" and ":11434" all work.
export function resolveOllamaBaseUrl(rawHost: string | undefined): string {
  const value = (rawHost ?? "").trim();
  const schemeEnd = value.indexOf("://");
  const scheme = schemeEnd >= 0 ? value.slice(0, schemeEnd).toLowerCase() : "http";
  const defaultPort = schemeEnd < 0 ? "11434" : scheme === "https" ? "443" : scheme === "http" ? "80" : "11434";
  const rest = schemeEnd >= 0 ? value.slice(schemeEnd + 3) : value;
  const pathStart = rest.indexOf("/");
  const hostPort = pathStart >= 0 ? rest.slice(0, pathStart) : rest;
  const pathname = pathStart >= 0 ? rest.slice(pathStart).replace(/\/+$/, "") : "";
  const split = splitHostAndPort(hostPort);
  const portNumber = Number(split.port);
  const port = split.port && Number.isInteger(portNumber) && portNumber >= 0 && portNumber <= 65535
    ? split.port
    : defaultPort;
  // 0.0.0.0 and :: mean "listen everywhere" to the server. Windows can't connect to them, so use loopback.
  const host = !split.host || split.host === "0.0.0.0"
    ? "127.0.0.1"
    : split.host === "::"
      ? "::1"
      : split.host;
  const formattedHost = host.includes(":") ? `[${host}]` : host;

  return `${scheme}://${formattedHost}:${port}${pathname}`;
}

function normalizeOpenAiCompatibleBaseUrl(rawBaseUrl: string): string {
  const normalized = normalizeBaseUrl(rawBaseUrl);

  try {
    const parsed = new URL(normalized);
    if (parsed.pathname === "/" || parsed.pathname === "") {
      parsed.pathname = "/v1";
    }

    return parsed.toString().replace(/\/$/, "");
  } catch {
    return normalized.endsWith("/v1") ? normalized : `${normalized}/v1`;
  }
}

function buildRuntimeId(kind: LocalRuntimeKind, baseUrl: string): string {
  return `${kind}:${baseUrl}`;
}

function dedupeCandidates(candidates: RuntimeCandidate[]): RuntimeCandidate[] {
  const seen = new Set<string>();

  return candidates.filter((candidate) => {
    if (seen.has(candidate.id)) {
      return false;
    }

    seen.add(candidate.id);
    return true;
  });
}

function buildRuntimeCandidates(): RuntimeCandidate[] {
  const candidates: RuntimeCandidate[] = [];
  const ollamaBaseUrl = resolveOllamaBaseUrl(process.env.OLLAMA_HOST);
  const envOpenAiBaseUrl = process.env.LOCAL_OPENAI_BASE_URL?.trim();
  const lmStudioBaseUrl = process.env.LM_STUDIO_BASE_URL?.trim() ?? "http://127.0.0.1:1234";
  const llamaCppBaseUrl = process.env.LLAMA_CPP_BASE_URL?.trim() ?? "http://127.0.0.1:8080";

  candidates.push({
    baseUrl: ollamaBaseUrl,
    id: buildRuntimeId("ollama", ollamaBaseUrl),
    kind: "ollama",
    label: "Ollama",
    priority: 10
  });

  const normalizedLmStudioBaseUrl = normalizeOpenAiCompatibleBaseUrl(lmStudioBaseUrl);
  candidates.push({
    baseUrl: normalizedLmStudioBaseUrl,
    id: buildRuntimeId("openai-compatible", normalizedLmStudioBaseUrl),
    kind: "openai-compatible",
    label: "LM Studio",
    priority: 20
  });

  const normalizedLlamaCppBaseUrl = normalizeOpenAiCompatibleBaseUrl(llamaCppBaseUrl);
  candidates.push({
    baseUrl: normalizedLlamaCppBaseUrl,
    id: buildRuntimeId("openai-compatible", normalizedLlamaCppBaseUrl),
    kind: "openai-compatible",
    label: "llama.cpp",
    priority: 30
  });

  if (envOpenAiBaseUrl) {
    const normalizedOpenAiBaseUrl = normalizeOpenAiCompatibleBaseUrl(envOpenAiBaseUrl);
    candidates.unshift({
      baseUrl: normalizedOpenAiBaseUrl,
      id: buildRuntimeId("openai-compatible", normalizedOpenAiBaseUrl),
      kind: "openai-compatible",
      label: "Local OpenAI-compatible server",
      priority: 5
    });
  }

  return dedupeCandidates(candidates).sort((left, right) => left.priority - right.priority);
}

function buildSetupTips(): string[] {
  return [
    "Ollama: start the app or service, then run a pull such as `ollama pull qwen2.5:7b-instruct`.",
    "LM Studio: load a chat model, start the local server, and leave its OpenAI-compatible endpoint running.",
    "llama.cpp: launch the server with a chat-capable model and its OpenAI-compatible API enabled."
  ];
}

function formatRuntimeCountSummary(runtimes: LocalRuntimeInfo[], models: LocalModelInfo[]): string {
  if (models.length === 0 || runtimes.length === 0) {
    return "No local AI runtime detected yet. Start Ollama, LM Studio, or a local OpenAI-compatible server, then refresh.";
  }

  if (runtimes.length === 1) {
    const runtime = runtimes[0];
    return `Connected to ${runtime.label} with ${runtime.modelCount} local model${runtime.modelCount === 1 ? "" : "s"}.`;
  }

  const runtimeLabels = runtimes.map((runtime) => runtime.label).join(", ");
  return `Found ${models.length} local models across ${runtimeLabels}.`;
}

function formatModelFootprint(sizeInBytes: number | undefined): string | null {
  if (!sizeInBytes || !Number.isFinite(sizeInBytes) || sizeInBytes <= 0) {
    return null;
  }

  const sizeInGiB = sizeInBytes / (1024 ** 3);
  if (sizeInGiB >= 1) {
    return `${sizeInGiB.toFixed(1)} GB`;
  }

  const sizeInMiB = sizeInBytes / (1024 ** 2);
  return `${Math.round(sizeInMiB)} MB`;
}

function buildAssistantSystemPrompt(request: AssistantRequest): string {
  return [
    "You are a local Mermaid diagram coach inside a desktop editor.",
    `Keep the diagram in Mermaid ${request.diagramType} format unless the user explicitly asks to switch.`,
    "Be practical, concise, and collaborative.",
    "Always return strict JSON with these string keys: assistantMessage, updatedSource, suggestedTitle.",
    "assistantMessage should explain what changed and mention any assumption you made.",
    "updatedSource must be a complete Mermaid document with no code fences.",
    "When fixing a render error, make the smallest valid Mermaid syntax change that preserves the user's intent.",
    "If the current source is blank, create a sensible first draft instead of asking the user to do the syntax work."
  ].join(" ");
}

// Models often wrap the diagram in a code fence even when told not to.
function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```[^\n]*\n([\s\S]*?)\n?```$/);
  return (fenced?.[1] ?? trimmed).trim();
}

function readDiagramSource(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  const source = stripCodeFence(value);
  // Some small models escape newlines twice, so the whole diagram arrives on one line with literal "\n".
  return !source.includes("\n") && source.includes("\\n") ? source.replace(/\\n/g, "\n") : source;
}

function readJsonObject(text: string): Record<string, unknown> | null {
  const fencedJson = text.match(/```(?:json)?[^\n]*\n([\s\S]*?)```/i)?.[1];

  for (const candidate of [fencedJson, text]) {
    if (!candidate) {
      continue;
    }

    const startIndex = candidate.indexOf("{");
    const endIndex = candidate.lastIndexOf("}");
    if (startIndex < 0 || endIndex < startIndex) {
      continue;
    }

    try {
      const parsed: unknown = JSON.parse(candidate.slice(startIndex, endIndex + 1));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Not JSON. The caller treats the reply as plain prose.
    }
  }

  return null;
}

// Prefers a block marked mermaid, then any fenced block.
function findDiagramBlock(text: string): { block: string; source: string } | null {
  const blocks = [...text.matchAll(/```[ \t]*([\w-]*)[^\n]*\n([\s\S]*?)```/g)];
  const chosen = blocks.find((match) => /^(mermaid|mmd)$/i.test(match[1] ?? "")) ?? blocks[0];
  const source = chosen?.[2]?.trim();

  return chosen && source ? { block: chosen[0], source } : null;
}

export function parseAssistantResponse(rawContent: string, fallbackSource: string, model: string): AssistantResponse {
  // Reasoning models can put their thinking in the reply itself.
  const content = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const parsed = readJsonObject(content);

  if (parsed) {
    const message = typeof parsed.assistantMessage === "string" ? parsed.assistantMessage.trim() : "";
    const title = typeof parsed.suggestedTitle === "string" ? parsed.suggestedTitle.trim() : "";

    return {
      assistantMessage: message || DEFAULT_ASSISTANT_MESSAGE,
      model,
      suggestedTitle: title || undefined,
      updatedSource: readDiagramSource(parsed.updatedSource) || fallbackSource
    };
  }

  // A plain answer is still an answer. Keep any diagram it includes as the draft.
  const diagram = findDiagramBlock(content);
  const prose = (diagram ? content.replace(diagram.block, "") : content).trim();

  return {
    assistantMessage: prose || (diagram ? DEFAULT_ASSISTANT_MESSAGE : "The model sent an empty reply. Try asking again."),
    model,
    updatedSource: diagram?.source || fallbackSource
  };
}

async function requestLocalRuntime(
  url: string,
  init?: RequestInit,
  timeoutMs = ASSISTANT_TIMEOUT_MS
): Promise<Response> {
  return fetch(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs)
  });
}

// Runtimes report errors as {"error": "..."} (Ollama) or {"error": {"message": "..."}} (OpenAI style).
function readErrorDetail(body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: unknown; message?: unknown };
    const error = parsed.error;
    if (typeof error === "string") {
      return error;
    }

    if (error && typeof error === "object" && typeof (error as { message?: unknown }).message === "string") {
      return (error as { message: string }).message;
    }

    if (typeof parsed.message === "string") {
      return parsed.message;
    }
  } catch {
    // Not JSON, so use the text itself.
  }

  const text = body.trim();
  return text.length > 200 ? `${text.slice(0, 200)}...` : text;
}

function describeFailedReply(runtime: ReachableRuntime, model: string, status: number, body: string): Error {
  const detail = readErrorDetail(body).replace(/\.$/, "");

  if (/does not support (chat|generate|completion)/i.test(detail)) {
    return new Error(`${model} can't chat, so it can't draft diagrams. Choose a different model under Local model.`);
  }

  return new Error(`${runtime.label} couldn't answer with ${model}: ${detail || `it returned status ${status}`}.`);
}

// fetch reports a refused connection as "fetch failed", and a timeout as a TimeoutError.
async function sendChatRequest(
  runtime: ReachableRuntime,
  model: string,
  url: string,
  body: unknown
): Promise<Response> {
  try {
    return await requestLocalRuntime(url, {
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST"
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new Error(`${model} took more than ${ASSISTANT_TIMEOUT_MS / 60_000} minutes to answer. Try again, or choose a smaller model.`);
    }

    throw new Error(`Couldn't reach ${runtime.label} at ${runtime.baseUrl}. Check it's still running, then choose Refresh Models.`);
  }
}

function readCapabilities(value: unknown): string[] | undefined {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : undefined;
}

// Recent Ollama lists capabilities with each model. Older versions only report them per model.
async function fetchOllamaCapabilities(baseUrl: string, modelId: string): Promise<string[] | undefined> {
  try {
    const response = await requestLocalRuntime(`${baseUrl}/api/show`, {
      body: JSON.stringify({ model: modelId }),
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST"
    }, PROBE_TIMEOUT_MS);
    if (!response.ok) {
      return undefined;
    }

    const payload = await response.json() as { capabilities?: unknown };
    return readCapabilities(payload.capabilities);
  } catch {
    return undefined;
  }
}

// "no" models, such as embedding models, are left out. Ollama versions that don't report capabilities give "unknown".
export function classifyOllamaModel(capabilities: string[] | undefined): ChatSupport | "no" {
  if (!capabilities) {
    return "unknown";
  }

  return capabilities.includes("completion") ? "yes" : "no";
}

// OpenAI-style servers don't say what a model can do, so this only stops an embedding model being picked by default.
export function classifyOpenAiCompatibleModel(modelId: string): ChatSupport {
  return /embed/i.test(modelId) ? "unlikely" : "unknown";
}

async function probeOllamaRuntime(candidate: RuntimeCandidate): Promise<ReachableRuntime | null> {
  try {
    const response = await requestLocalRuntime(`${candidate.baseUrl}/api/tags`, undefined, PROBE_TIMEOUT_MS);
    if (!response.ok) {
      return null;
    }

    const payload = await response.json() as {
      models?: Array<{
        capabilities?: unknown;
        details?: {
          parameter_size?: string;
          quantization_level?: string;
        };
        name?: string;
        size?: number;
      }>;
    };

    const listedModels = await Promise.all((payload.models ?? []).map(async (model) => {
      const modelId = model.name?.trim();
      if (!modelId) {
        return null;
      }

      const capabilities = readCapabilities(model.capabilities)
        ?? await fetchOllamaCapabilities(candidate.baseUrl, modelId);
      const chat = classifyOllamaModel(capabilities);
      if (chat === "no") {
        return null;
      }

      const descriptor = model.details?.parameter_size
        ?? model.details?.quantization_level
        ?? formatModelFootprint(model.size);

      return {
        chat,
        id: `${candidate.id}::${modelId}`,
        label: descriptor ? `${modelId} • ${descriptor} • ${candidate.label}` : `${modelId} • ${candidate.label}`,
        modelId,
        runtimeId: candidate.id,
        runtimeLabel: candidate.label
      } satisfies LocalModelInfo;
    }));
    const models = listedModels.filter((model): model is LocalModelInfo => model !== null);

    return {
      ...candidate,
      models
    };
  } catch {
    return null;
  }
}

async function probeOpenAiCompatibleRuntime(candidate: RuntimeCandidate): Promise<ReachableRuntime | null> {
  try {
    const response = await requestLocalRuntime(`${candidate.baseUrl}/models`, undefined, PROBE_TIMEOUT_MS);
    if (!response.ok) {
      return null;
    }

    const payload = await response.json() as {
      data?: Array<{
        id?: string;
        owned_by?: string;
      }>;
    };

    const models = (payload.data ?? [])
      .map((model) => {
        const modelId = model.id?.trim();
        if (!modelId) {
          return null;
        }

        const owner = model.owned_by?.trim();

        return {
          chat: classifyOpenAiCompatibleModel(modelId),
          id: `${candidate.id}::${modelId}`,
          label: owner
            ? `${modelId} • ${candidate.label} • ${owner}`
            : `${modelId} • ${candidate.label}`,
          modelId,
          runtimeId: candidate.id,
          runtimeLabel: candidate.label
        } satisfies LocalModelInfo;
      })
      .filter((model): model is LocalModelInfo => model !== null);

    return {
      ...candidate,
      models
    };
  } catch {
    return null;
  }
}

async function probeRuntime(candidate: RuntimeCandidate): Promise<ReachableRuntime | null> {
  if (candidate.kind === "ollama") {
    return probeOllamaRuntime(candidate);
  }

  return probeOpenAiCompatibleRuntime(candidate);
}

async function listReachableRuntimes(): Promise<ReachableRuntime[]> {
  const candidates = buildRuntimeCandidates();
  const reachableRuntimes = await Promise.all(candidates.map((candidate) => probeRuntime(candidate)));

  return reachableRuntimes
    .filter((runtime): runtime is ReachableRuntime => runtime !== null)
    .sort((left, right) => left.priority - right.priority);
}

function toRuntimeInfo(runtime: ReachableRuntime): LocalRuntimeInfo {
  return {
    baseUrl: runtime.baseUrl,
    id: runtime.id,
    kind: runtime.kind,
    label: runtime.label,
    modelCount: runtime.models.length
  };
}

function buildFocusedPrompt(request: AssistantRequest): string {
  return [
    `Current diagram type: ${request.diagramType}`,
    `Focused area: ${request.selectedNode ?? "entire diagram"}`,
    "Current Mermaid source:",
    request.source.trim() || "(empty document)"
  ].join("\n");
}

async function generateOllamaReply(
  runtime: ReachableRuntime,
  request: AssistantRequest
): Promise<AssistantResponse> {
  const response = await sendChatRequest(runtime, request.model, `${runtime.baseUrl}/api/chat`, {
    format: "json",
    messages: [
      {
        role: "system",
        content: buildAssistantSystemPrompt(request)
      },
      {
        role: "user",
        content: buildFocusedPrompt(request)
      },
      ...request.chatHistory
    ],
    model: request.model,
    options: {
      temperature: 0.25
    },
    stream: false
  });

  if (!response.ok) {
    throw describeFailedReply(runtime, request.model, response.status, await response.text());
  }

  const payload = await response.json() as {
    message?: {
      content?: string;
    };
    model?: string;
  };

  if (!payload.message?.content) {
    throw new Error(`${runtime.label} sent an empty reply. Try asking again.`);
  }

  return parseAssistantResponse(payload.message.content, request.source, payload.model ?? request.model);
}

async function generateOpenAiCompatibleReply(
  runtime: ReachableRuntime,
  request: AssistantRequest
): Promise<AssistantResponse> {
  const url = `${runtime.baseUrl}/chat/completions`;
  const body = {
    messages: [
      {
        role: "system",
        content: buildAssistantSystemPrompt(request)
      },
      {
        role: "user",
        content: buildFocusedPrompt(request)
      },
      ...request.chatHistory
    ],
    model: request.model,
    temperature: 0.25
  };
  let response = await sendChatRequest(runtime, request.model, url, {
    ...body,
    response_format: {
      json_schema: {
        name: "diagram_reply",
        schema: REPLY_SCHEMA
      },
      type: "json_schema"
    }
  });

  // Not every server or model accepts a schema. Ask once more without one, and rely on the prompt.
  if (response.status === 400 || response.status === 422) {
    await response.text();
    response = await sendChatRequest(runtime, request.model, url, body);
  }

  if (!response.ok) {
    throw describeFailedReply(runtime, request.model, response.status, await response.text());
  }

  const payload = await response.json() as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
    model?: string;
  };

  const rawContent = payload.choices?.[0]?.message?.content;
  if (!rawContent) {
    throw new Error(`${runtime.label} sent an empty reply. Try asking again.`);
  }

  return parseAssistantResponse(rawContent, request.source, payload.model ?? request.model);
}

export async function getAssistantRuntimeState(): Promise<AssistantRuntimeState> {
  const reachableRuntimes = await listReachableRuntimes();
  const runtimes = reachableRuntimes.map((runtime) => toRuntimeInfo(runtime));
  const models = reachableRuntimes.flatMap((runtime) => runtime.models);

  return {
    models,
    runtimes,
    setupTips: buildSetupTips(),
    statusMessage: formatRuntimeCountSummary(runtimes, models)
  };
}

export async function generateAssistantReply(request: AssistantRequest): Promise<AssistantResponse> {
  const reachableRuntimes = await listReachableRuntimes();
  const runtime = reachableRuntimes.find((candidate) => candidate.id === request.runtimeId);

  if (!runtime) {
    throw new Error("The selected local AI runtime is not available right now. Refresh models and try again.");
  }

  if (runtime.kind === "ollama") {
    return generateOllamaReply(runtime, request);
  }

  return generateOpenAiCompatibleReply(runtime, request);
}
