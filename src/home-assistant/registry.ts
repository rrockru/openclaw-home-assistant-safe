import { normalizeBaseUrl, requireConfigured } from "../config.js";
import type {
  AreaRegistryEntry,
  DeviceRegistryEntry,
  EntityRegistryEntry,
  PluginConfig,
  RegistrySnapshot,
} from "../types.js";
import { haWebSocketCommands } from "./websocket-client.js";

interface CacheEntry {
  expiresAt: number;
  snapshot: RegistrySnapshot;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(config: PluginConfig & { url: string; tokenFile: string }): string {
  return `${normalizeBaseUrl(config.url)}\n${config.tokenFile}`;
}

function asMap<T, K extends string>(items: readonly T[], keyOf: (item: T) => K): Map<K, T> {
  return new Map(items.map((item) => [keyOf(item), item]));
}

async function fetchRegistrySnapshot(config: PluginConfig, signal?: AbortSignal): Promise<RegistrySnapshot> {
  const [entitiesRaw, devicesRaw, areasRaw] = await haWebSocketCommands<[
    EntityRegistryEntry[],
    DeviceRegistryEntry[],
    AreaRegistryEntry[],
  ]>(
    config,
    [
      { type: "config/entity_registry/list" },
      { type: "config/device_registry/list" },
      { type: "config/area_registry/list" },
    ],
    signal,
  );

  return {
    entities: asMap(entitiesRaw, (entry) => entry.entity_id),
    devices: asMap(devicesRaw, (entry) => entry.id),
    areas: asMap(areasRaw, (entry) => entry.area_id),
  };
}

export async function getRegistrySnapshot(config: PluginConfig, signal?: AbortSignal): Promise<RegistrySnapshot> {
  requireConfigured(config);
  const ttlMs = config.registryCacheTtlMs ?? 300000;
  const key = cacheKey(config);
  const now = Date.now();

  if (ttlMs > 0) {
    const existing = cache.get(key);
    if (existing && existing.expiresAt > now) return existing.snapshot;
  }

  const snapshot = await fetchRegistrySnapshot(config, signal);
  if (ttlMs > 0) cache.set(key, { expiresAt: now + ttlMs, snapshot });
  else cache.delete(key);
  return snapshot;
}

export function clearRegistryCache(): void {
  cache.clear();
}
