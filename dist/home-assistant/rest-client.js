import { normalizeBaseUrl, requireConfigured } from "../config.js";
import { loadToken } from "../security.js";
function linkedAbortController(signal, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error("Home Assistant request timed out")), timeoutMs);
    const onAbort = () => controller.abort(signal?.reason);
    if (signal) {
        if (signal.aborted)
            controller.abort(signal.reason);
        else
            signal.addEventListener("abort", onAbort, { once: true });
    }
    return {
        controller,
        cleanup: () => {
            clearTimeout(timer);
            if (signal)
                signal.removeEventListener("abort", onAbort);
        },
    };
}
export async function haRequest(config, path, options = {}, signal) {
    requireConfigured(config);
    const token = await loadToken(config.tokenFile);
    const timeoutMs = config.requestTimeoutMs ?? 8000;
    const { controller, cleanup } = linkedAbortController(signal, timeoutMs);
    try {
        const response = await fetch(`${normalizeBaseUrl(config.url)}${path}`, {
            ...options,
            signal: controller.signal,
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                ...(options.headers ?? {}),
            },
        });
        const text = await response.text();
        let body = null;
        if (text) {
            try {
                body = JSON.parse(text);
            }
            catch {
                body = text;
            }
        }
        if (!response.ok) {
            const detail = typeof body === "string" ? body : JSON.stringify(body);
            throw new Error(`Home Assistant API ${response.status}: ${detail}`);
        }
        return body;
    }
    finally {
        cleanup();
    }
}
export function listStates(config, signal) {
    return haRequest(config, "/api/states", {}, signal);
}
export function readState(config, entityId, signal) {
    return haRequest(config, `/api/states/${encodeURIComponent(entityId)}`, {}, signal);
}
//# sourceMappingURL=rest-client.js.map