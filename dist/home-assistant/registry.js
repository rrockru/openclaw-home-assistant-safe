import { normalizeBaseUrl, requireConfigured } from "../config.js";
import { haWebSocketCommands } from "./websocket-client.js";
const cache = new Map();
const refreshes = new Map();
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
function waitForPromise(promise, signal) {
    if (!signal) {
        return promise;
    }
    signal.throwIfAborted();
    return new Promise((resolve, reject) => {
        const onAbort = () => {
            reject(signal.reason ?? new Error("Home Assistant registry request aborted"));
        };
        signal.addEventListener("abort", onAbort, { once: true });
        promise.then((value) => {
            signal.removeEventListener("abort", onAbort);
            resolve(value);
        }, (error) => {
            signal.removeEventListener("abort", onAbort);
            reject(error);
        });
    });
}
function startRegistryRefresh(key, config) {
    const existing = refreshes.get(key);
    if (existing) {
        return existing;
    }
    const refresh = fetchRegistrySnapshot(config).finally(() => {
        if (refreshes.get(key) === refresh) {
            refreshes.delete(key);
        }
    });
    refreshes.set(key, refresh);
    return refresh;
}
export async function getRegistrySnapshot(config, signal) {
    requireConfigured(config);
    const ttlMs = config.registryCacheTtlMs ?? 300000;
    const key = cacheKey(config);
    if (ttlMs > 0) {
        const existing = cache.get(key);
        if (existing && existing.expiresAt > Date.now()) {
            return existing.snapshot;
        }
    }
    const snapshot = await waitForPromise(startRegistryRefresh(key, config), signal);
    if (ttlMs > 0) {
        cache.set(key, {
            expiresAt: Date.now() + ttlMs,
            snapshot
        });
    }
    else {
        cache.delete(key);
    }
    return snapshot;
}
export function clearRegistryCache() {
    cache.clear();
}
//# sourceMappingURL=registry.js.map