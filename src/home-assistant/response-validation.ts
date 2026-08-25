import type { AreaRegistryEntry, DeviceRegistryEntry, EntityRegistryEntry, HomeAssistantState } from "../types.js";

type JsonObject = Record<string, unknown>;

function object(value: unknown, description: string): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Home Assistant returned invalid ${description}`);
  }
  return value as JsonObject;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string") throw new Error(`Home Assistant response is missing string ${field}`);
  return value;
}

function optionalString(value: unknown, field: string): string | null | undefined {
  if (value === undefined || value === null || typeof value === "string") return value;
  throw new Error(`Home Assistant response has invalid ${field}`);
}

function array(value: unknown, description: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`Home Assistant returned invalid ${description}`);
  return value;
}

export function parseState(value: unknown): HomeAssistantState {
  const record = object(value, "state");
  const attributes = record.attributes === undefined ? undefined : object(record.attributes, "state attributes");
  return {
    entity_id: requiredString(record.entity_id, "entity_id"),
    state: requiredString(record.state, "state"),
    ...(attributes === undefined ? {} : { attributes }),
    ...(record.last_changed === undefined ? {} : { last_changed: requiredString(record.last_changed, "last_changed") }),
    ...(record.last_updated === undefined ? {} : { last_updated: requiredString(record.last_updated, "last_updated") }),
  };
}

export function parseStates(value: unknown): HomeAssistantState[] {
  return array(value, "states list").map(parseState);
}

export function parseEntityRegistry(value: unknown): EntityRegistryEntry[] {
  return array(value, "entity registry").map((item) => {
    const record = object(item, "entity registry entry");
    const deviceId = optionalString(record.device_id, "device_id");
    const areaId = optionalString(record.area_id, "area_id");
    const name = optionalString(record.name, "name");
    const originalName = optionalString(record.original_name, "original_name");
    return {
      entity_id: requiredString(record.entity_id, "entity_id"),
      ...(deviceId === undefined ? {} : { device_id: deviceId }),
      ...(areaId === undefined ? {} : { area_id: areaId }),
      ...(name === undefined ? {} : { name }),
      ...(originalName === undefined ? {} : { original_name: originalName }),
    };
  });
}

export function parseDeviceRegistry(value: unknown): DeviceRegistryEntry[] {
  return array(value, "device registry").map((item) => {
    const record = object(item, "device registry entry");
    const areaId = optionalString(record.area_id, "area_id");
    const name = optionalString(record.name, "name");
    const nameByUser = optionalString(record.name_by_user, "name_by_user");
    return {
      id: requiredString(record.id, "id"),
      ...(areaId === undefined ? {} : { area_id: areaId }),
      ...(name === undefined ? {} : { name }),
      ...(nameByUser === undefined ? {} : { name_by_user: nameByUser }),
    };
  });
}

export function parseAreaRegistry(value: unknown): AreaRegistryEntry[] {
  return array(value, "area registry").map((item) => {
    const record = object(item, "area registry entry");
    const aliases = record.aliases;
    if (aliases !== undefined && (!Array.isArray(aliases) || aliases.some((alias) => typeof alias !== "string"))) {
      throw new Error("Home Assistant response has invalid aliases");
    }
    return {
      area_id: requiredString(record.area_id, "area_id"),
      name: requiredString(record.name, "name"),
      ...(aliases === undefined ? {} : { aliases }),
    };
  });
}
