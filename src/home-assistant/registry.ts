import { normalizeBaseUrl, requireConfigured } from "../config.js";
import type { PluginConfig, RegistrySnapshot } from "../types.js";
import { parseAreaRegistry, parseDeviceRegistry, parseEntityRegistry } from "./response-validation.js";
import { haWebSocketCommands } from "./websocket-client.js";

interface CacheEntry {
  cachedAt: number;
  snapshot: RegistrySnapshot;
}

const cache = new Map<string, CacheEntry>();
const refreshes = new Map<string, Promise<RegistrySnapshot>>();
const MAX_CACHE_ENTRIES = 16;

function errorReason(reason: unknown, fallback: string): Error {
  return reason instanceof Error ? reason : new Error(fallback);
}

const REGISTRY_COMMANDS = [
  { type: "config/entity_registry/list" },
  { type: "config/device_registry/list" },
  { type: "config/area_registry/list" },
] as const;

function cacheKey(config: PluginConfig & { url: string; tokenFile: string }): string {
  return `${normalizeBaseUrl(config.url)}\n${config.tokenFile}`;
}

function asMap<T, K extends string>(items: readonly T[], keyOf: (item: T) => K): Map<K, T> {
  return new Map(items.map((item) => [keyOf(item), item]));
}

async function fetchRegistrySnapshot(config: PluginConfig, signal?: AbortSignal): Promise<RegistrySnapshot> {
  const [entitiesRaw, devicesRaw, areasRaw] = await haWebSocketCommands(config, REGISTRY_COMMANDS, signal);

  const entities = parseEntityRegistry(entitiesRaw);
  const devices = parseDeviceRegistry(devicesRaw);
  const areas = parseAreaRegistry(areasRaw);

  return {
    entities: asMap(entities, (entry) => entry.entity_id),
    devices: asMap(devices, (entry) => entry.id),
    areas: asMap(areas, (entry) => entry.area_id),
  };
}

function waitForPromise<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) {
    return promise;
  }

  signal.throwIfAborted();

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      reject(errorReason(signal.reason, "Home Assistant registry request aborted"));
    };

    signal.addEventListener("abort", onAbort, { once: true });

    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(errorReason(error, "Home Assistant registry refresh failed"));
      },
    );
  });
}

function startRegistryRefresh(key: string, config: PluginConfig): Promise<RegistrySnapshot> {
  const existing = refreshes.get(key);
  if (existing) {
    return existing;
  }

  const refresh = fetchRegistrySnapshot(config)
    .catch((error: unknown) => {
      cache.delete(key);
      throw error;
    })
    .finally(() => {
      if (refreshes.get(key) === refresh) {
        refreshes.delete(key);
      }
    });

  refreshes.set(key, refresh);
  return refresh;
}

function cacheSnapshot(key: string, snapshot: RegistrySnapshot): void {
  cache.delete(key);
  cache.set(key, { cachedAt: Date.now(), snapshot });
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) break;
    cache.delete(oldestKey);
  }
}

export async function getRegistrySnapshot(config: PluginConfig, signal?: AbortSignal): Promise<RegistrySnapshot> {
  requireConfigured(config);
  const ttlMs = config.registryCacheTtlMs ?? 300000;
  const key = cacheKey(config);

  if (ttlMs > 0) {
    const existing = cache.get(key);
    if (existing && Date.now() - existing.cachedAt < ttlMs) {
      cache.delete(key);
      cache.set(key, existing);
      return existing.snapshot;
    }
    if (existing) cache.delete(key);
  }

  const snapshot = await waitForPromise(startRegistryRefresh(key, config), signal);
  if (ttlMs > 0) cacheSnapshot(key, snapshot);
  else cache.delete(key);
  return snapshot;
}

export function clearRegistryCache(): void {
  cache.clear();
}
