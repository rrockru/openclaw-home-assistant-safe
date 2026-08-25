export interface PluginConfig {
    url?: string;
    tokenFile?: string;
    readableEntities?: string[];
    writableEntities?: string[];
    blockedEntities?: string[];
    requestTimeoutMs?: number;
    registryCacheTtlMs?: number;
}
export interface HomeAssistantState {
    entity_id: string;
    state: string;
    attributes?: Record<string, unknown>;
    last_changed?: string;
    last_updated?: string;
}
export interface EntityRegistryEntry {
    entity_id: string;
    device_id?: string | null;
    area_id?: string | null;
    name?: string | null;
    original_name?: string | null;
}
export interface DeviceRegistryEntry {
    id: string;
    area_id?: string | null;
    name?: string | null;
    name_by_user?: string | null;
}
export interface AreaRegistryEntry {
    area_id: string;
    name: string;
    aliases?: string[];
}
export interface RegistrySnapshot {
    entities: Map<string, EntityRegistryEntry>;
    devices: Map<string, DeviceRegistryEntry>;
    areas: Map<string, AreaRegistryEntry>;
}
