import { createEntityAccessPolicy } from "../security.js";
import type {
  AreaRegistryEntry,
  DeviceRegistryEntry,
  EntityRegistryEntry,
  HomeAssistantState,
  PluginConfig,
  RegistrySnapshot,
} from "../types.js";

export interface EntityListFilters {
  domain?: string;
  deviceClass?: string;
  area?: string;
  limit?: number;
}

export interface CompactEntityState {
  entity_id: string;
  state: string;
  friendly_name: string | null;
  device_class: string | null;
  unit_of_measurement: string | null;
  device_id: string | null;
  device_name: string | null;
  area_id: string | null;
  area_name: string | null;
  area_aliases: string[];
}

function stringAttribute(state: HomeAssistantState, key: string): string | null {
  const value = state.attributes?.[key];
  return typeof value === "string" ? value : null;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

interface ResolvedEntityContext {
  entity: EntityRegistryEntry | undefined;
  device: DeviceRegistryEntry | undefined;
  area: AreaRegistryEntry | undefined;
  effectiveAreaId: string | null;
}

function resolveEffectiveAreaId(
  entity: EntityRegistryEntry | undefined,
  device: DeviceRegistryEntry | undefined,
): string | null {
  return entity?.area_id ?? device?.area_id ?? null;
}

function resolveEntityContext(
  entityId: string,
  registry: RegistrySnapshot,
): ResolvedEntityContext {
  const entity = registry.entities.get(entityId);
  const device = entity?.device_id ? registry.devices.get(entity.device_id) : undefined;
  const effectiveAreaId = resolveEffectiveAreaId(entity, device);

  return {
    entity,
    device,
    effectiveAreaId,
    area: effectiveAreaId ? registry.areas.get(effectiveAreaId) : undefined,
  };
}

function matchingAreaIds(
  registry: RegistrySnapshot,
  query: string | undefined,
): ReadonlySet<string> | undefined {
  if (query === undefined || query.length === 0) return undefined;

  const needle = normalize(query);
  const matchingIds = new Set<string>();
  for (const area of registry.areas.values()) {
    if (
      normalize(area.area_id) === needle
      || normalize(area.name) === needle
      || (area.aliases ?? []).some((alias) => normalize(alias) === needle)
    ) {
      matchingIds.add(area.area_id);
    }
  }
  return matchingIds;
}

function compactState(
  state: HomeAssistantState,
  context: ResolvedEntityContext,
  deviceClass: string | null,
): CompactEntityState {
  const { entity, device, area } = context;

  return {
    entity_id: state.entity_id,
    state: state.state,
    friendly_name: stringAttribute(state, "friendly_name") ?? entity?.name ?? entity?.original_name ?? null,
    device_class: deviceClass,
    unit_of_measurement: stringAttribute(state, "unit_of_measurement"),
    device_id: device?.id ?? null,
    device_name: device?.name_by_user ?? device?.name ?? null,
    area_id: area?.area_id ?? null,
    area_name: area?.name ?? null,
    area_aliases: area?.aliases ?? [],
  };
}

export function filterAndEnrichStates(
  states: readonly HomeAssistantState[],
  config: PluginConfig,
  registry: RegistrySnapshot,
  filters: EntityListFilters,
): { count: number; matched: number; truncated: boolean; entities: CompactEntityState[] } {
  const domain = filters.domain === undefined ? undefined : normalize(filters.domain);
  const deviceClass = filters.deviceClass === undefined ? undefined : normalize(filters.deviceClass);
  const areaIds = matchingAreaIds(registry, filters.area);
  const limit = filters.limit ?? 200;
  const access = createEntityAccessPolicy(config);
  const entities: CompactEntityState[] = [];
  let matched = 0;

  for (const state of states) {
    if (!access.canRead(state.entity_id)) continue;
    if (domain && !state.entity_id.toLowerCase().startsWith(`${domain}.`)) continue;

    const stateDeviceClass = stringAttribute(state, "device_class");
    if (deviceClass && (!stateDeviceClass || normalize(stateDeviceClass) !== deviceClass)) continue;

    const context = resolveEntityContext(state.entity_id, registry);
    if (areaIds && (!context.effectiveAreaId || !areaIds.has(context.effectiveAreaId))) continue;

    matched += 1;
    if (entities.length < limit) {
      entities.push(compactState(state, context, stateDeviceClass));
    }
  }

  return {
    count: entities.length,
    matched,
    truncated: matched > entities.length,
    entities,
  };
}
