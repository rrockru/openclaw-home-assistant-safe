import { canRead } from "../security.js";
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
  return value.trim().toLocaleLowerCase();
}

function resolveArea(
  entity: EntityRegistryEntry | undefined,
  device: DeviceRegistryEntry | undefined,
  registry: RegistrySnapshot,
): AreaRegistryEntry | undefined {
  const areaId = entity?.area_id ?? device?.area_id ?? null;
  return areaId ? registry.areas.get(areaId) : undefined;
}

function areaMatches(area: AreaRegistryEntry | undefined, query: string | undefined): boolean {
  if (!query) return true;
  if (!area) return false;

  const needle = normalize(query);
  if (normalize(area.area_id) === needle || normalize(area.name) === needle) return true;
  return (area.aliases ?? []).some((alias) => normalize(alias) === needle);
}

function compactState(state: HomeAssistantState, registry: RegistrySnapshot): CompactEntityState {
  const entity = registry.entities.get(state.entity_id);
  const device = entity?.device_id ? registry.devices.get(entity.device_id) : undefined;
  const area = resolveArea(entity, device, registry);

  return {
    entity_id: state.entity_id,
    state: state.state,
    friendly_name: stringAttribute(state, "friendly_name") ?? entity?.name ?? entity?.original_name ?? null,
    device_class: stringAttribute(state, "device_class"),
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
  const domain = filters.domain?.trim().toLocaleLowerCase();
  const deviceClass = filters.deviceClass?.trim().toLocaleLowerCase();
  const limit = filters.limit ?? 200;

  const matched = states
    .filter((state) => canRead(config, state.entity_id))
    .filter((state) => !domain || state.entity_id.toLocaleLowerCase().startsWith(`${domain}.`))
    .map((state) => compactState(state, registry))
    .filter((state) => !deviceClass || state.device_class?.toLocaleLowerCase() === deviceClass)
    .filter((state) => {
      if (!filters.area) return true;
      const area = state.area_id ? registry.areas.get(state.area_id) : undefined;
      return areaMatches(area, filters.area);
    });

  const entities = matched.slice(0, limit);
  return {
    count: entities.length,
    matched: matched.length,
    truncated: matched.length > entities.length,
    entities,
  };
}
