import { Type } from "typebox";
export const configSchema = Type.Object({
    url: Type.Optional(Type.String({ description: "Home Assistant base URL, for example http://192.168.1.30:8123." })),
    tokenFile: Type.Optional(Type.String({ description: "Path to a file containing a Home Assistant Long-Lived Access Token." })),
    readableEntities: Type.Optional(Type.Array(Type.String(), {
        default: [],
        description: "Entity IDs or simple wildcard patterns allowed for reads, for example sensor.*.",
    })),
    writableEntities: Type.Optional(Type.Array(Type.String(), {
        default: [],
        description: "Entity IDs or simple wildcard patterns allowed for turn_on/turn_off. Empty means read-only.",
    })),
    blockedEntities: Type.Optional(Type.Array(Type.String(), {
        default: [],
        description: "Entity IDs or wildcard patterns always denied. Block rules override allow rules.",
    })),
    requestTimeoutMs: Type.Optional(Type.Integer({
        minimum: 1000,
        maximum: 30000,
        default: 8000,
        description: "Timeout for Home Assistant REST and WebSocket requests.",
    })),
    registryCacheTtlMs: Type.Optional(Type.Integer({
        minimum: 0,
        maximum: 3600000,
        default: 300000,
        description: "TTL for Home Assistant entity/device/area registry metadata. Set to 0 to disable caching.",
    })),
}, { additionalProperties: false });
export function requireConfigured(config) {
    if (!config?.url || !config?.tokenFile) {
        throw new Error("Home Assistant Safe is not configured: set plugins.entries.home-assistant-safe.config.url and tokenFile");
    }
}
export function normalizeBaseUrl(url) {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error("Home Assistant url must use http or https");
    }
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
}
export function webSocketUrl(url) {
    const parsed = new URL(normalizeBaseUrl(url));
    parsed.protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
    parsed.pathname = `${parsed.pathname.replace(/\/+$/, "")}/api/websocket`;
    return parsed.toString();
}
//# sourceMappingURL=config.js.map