import { normalizeBaseUrl, requireConfigured } from "../config.js";
import { haWebSocketCommands } from "./websocket-client.js";
const cache = new Map();
function cacheKey(config) {
    return `${normalizeBaseUrl(config.url)}\n${config.tokenFile}`;
}
function asMap(items, keyOf) {
    return new Map(items.map((item) => [keyOf(item), item]));
}
async function fetchRegistrySnapshot(config, signal) {
    const [entitiesRaw, devicesRaw, areasRaw] = await haWebSocketCommands(config, [
        { type: "config/entity_registry/list" },
        { type: "config/device_registry/list" },
        { type: "config/area_registry/list" },
    ], signal);
    return {
        entities: asMap(entitiesRaw, (entry) => entry.entity_id),
        devices: asMap(devicesRaw, (entry) => entry.id),
        areas: asMap(areasRaw, (entry) => entry.area_id),
    };
}
export async function getRegistrySnapshot(config, signal) {
    requireConfigured(config);
    const ttlMs = config.registryCacheTtlMs ?? 300000;
    const key = cacheKey(config);
    const now = Date.now();
    if (ttlMs > 0) {
        const existing = cache.get(key);
        if (existing && existing.expiresAt > now)
            return existing.snapshot;
    }
    const snapshot = await fetchRegistrySnapshot(config, signal);
    if (ttlMs > 0)
        cache.set(key, { expiresAt: now + ttlMs, snapshot });
    else
        cache.delete(key);
    return snapshot;
}
export function clearRegistryCache() {
    cache.clear();
}
//# sourceMappingURL=registry.js.map