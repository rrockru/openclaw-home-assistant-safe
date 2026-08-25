import { normalizeBaseUrl, requireConfigured } from "../config.js";
import { loadToken } from "../security.js";
import type { HomeAssistantState, PluginConfig } from "../types.js";
import { parseState, parseStates } from "./response-validation.js";

const MAX_RESPONSE_BYTES = 16 * 1024 * 1024;
const MAX_ERROR_DETAIL_LENGTH = 2_000;

function linkedAbortController(
  signal: AbortSignal | undefined,
  timeoutMs: number,
): {
  controller: AbortController;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("Home Assistant request timed out")), timeoutMs);
  const onAbort = () => controller.abort(signal?.reason);

  if (signal) {
    if (signal.aborted) controller.abort(signal.reason);
    else signal.addEventListener("abort", onAbort, { once: true });
  }

  return {
    controller,
    cleanup: () => {
      clearTimeout(timer);
      if (signal) signal.removeEventListener("abort", onAbort);
    },
  };
}

async function readResponseText(response: Response): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    throw new Error("Home Assistant API response exceeded the 16 MiB limit");
  }
  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error("Home Assistant API response exceeded the 16 MiB limit");
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

function errorDetail(body: unknown): string {
  const detail = typeof body === "string" ? body : JSON.stringify(body);
  return detail.length <= MAX_ERROR_DETAIL_LENGTH ? detail : `${detail.slice(0, MAX_ERROR_DETAIL_LENGTH)}…`;
}

export async function haRequest(
  config: PluginConfig,
  path: string,
  options: RequestInit = {},
  signal?: AbortSignal,
): Promise<unknown> {
  requireConfigured(config);
  signal?.throwIfAborted();

  const token = await loadToken(config.tokenFile);
  signal?.throwIfAborted();
  const timeoutMs = config.requestTimeoutMs ?? 8000;
  const { controller, cleanup } = linkedAbortController(signal, timeoutMs);

  try {
    let response: Response;
    try {
      const headers = new Headers(options.headers);
      headers.set("Authorization", `Bearer ${token}`);
      headers.set("Content-Type", "application/json");
      response = await fetch(`${normalizeBaseUrl(config.url)}${path}`, {
        ...options,
        signal: controller.signal,
        headers,
      });
    } catch (error) {
      if (controller.signal.aborted) throw controller.signal.reason ?? error;
      throw new Error("Home Assistant API request failed", { cause: error });
    }

    const text = await readResponseText(response);
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }

    if (!response.ok) {
      throw new Error(`Home Assistant API ${response.status}: ${errorDetail(body)}`);
    }

    return body;
  } finally {
    cleanup();
  }
}

export function listStates(config: PluginConfig, signal?: AbortSignal): Promise<HomeAssistantState[]> {
  return haRequest(config, "/api/states", {}, signal).then(parseStates);
}

export function readState(config: PluginConfig, entityId: string, signal?: AbortSignal): Promise<HomeAssistantState> {
  return haRequest(config, `/api/states/${encodeURIComponent(entityId)}`, {}, signal).then(parseState);
}
