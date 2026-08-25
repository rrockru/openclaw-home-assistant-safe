import { requireConfigured, webSocketUrl } from "../config.js";
import { loadToken } from "../security.js";
export async function haWebSocketCommands(config, commands, signal) {
    requireConfigured(config);
    signal?.throwIfAborted();
    const token = await loadToken(config.tokenFile);
    signal?.throwIfAborted();
    const timeoutMs = config.requestTimeoutMs ?? 8000;
    return await new Promise((resolve, reject) => {
        const socket = new WebSocket(webSocketUrl(config.url));
        const results = new Array(commands.length);
        const received = new Array(commands.length).fill(false);
        let authenticated = false;
        let settled = false;
        let nextCommandId = 1;
        let pending = commands.length;
        const finish = (error) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            signal?.removeEventListener("abort", onAbort);
            try {
                socket.close();
            }
            catch {
                // Best effort only.
            }
            if (error)
                reject(error);
            else
                resolve(results);
        };
        const timer = setTimeout(() => finish(new Error("Home Assistant WebSocket request timed out")), timeoutMs);
        const onAbort = () => finish(signal?.reason ?? new Error("Home Assistant WebSocket request aborted"));
        signal?.addEventListener("abort", onAbort, { once: true });
        socket.addEventListener("error", () => finish(new Error("Home Assistant WebSocket connection failed")));
        socket.addEventListener("close", () => {
            if (!settled) {
                finish(new Error(authenticated
                    ? "Home Assistant WebSocket connection closed before all responses arrived"
                    : "Home Assistant WebSocket connection closed before authentication completed"));
            }
        });
        socket.addEventListener("message", (event) => {
            let message;
            try {
                message = JSON.parse(String(event.data));
            }
            catch {
                finish(new Error("Home Assistant WebSocket returned invalid JSON"));
                return;
            }
            if (!authenticated) {
                if (message.type === "auth_required") {
                    socket.send(JSON.stringify({ type: "auth", access_token: token }));
                    return;
                }
                if (message.type === "auth_invalid") {
                    finish(new Error(`Home Assistant WebSocket authentication failed${message.message ? `: ${message.message}` : ""}`));
                    return;
                }
                if (message.type !== "auth_ok")
                    return;
                authenticated = true;
                if (commands.length === 0) {
                    finish();
                    return;
                }
                for (const command of commands) {
                    const id = nextCommandId++;
                    socket.send(JSON.stringify({ id, ...command }));
                }
                return;
            }
            if (message.type !== "result" || typeof message.id !== "number")
                return;
            if (message.id < 1 || message.id > commands.length)
                return;
            if (!message.success) {
                const detail = message.error?.message ?? message.error?.code ?? "unknown error";
                finish(new Error(`Home Assistant WebSocket command failed: ${detail}`));
                return;
            }
            const index = message.id - 1;
            if (received[index])
                return;
            received[index] = true;
            results[index] = message.result;
            pending -= 1;
            if (pending === 0)
                finish();
        });
    });
}
//# sourceMappingURL=websocket-client.js.map