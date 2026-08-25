import type { HomeAssistantState, PluginConfig, RegistrySnapshot } from "../types.js";
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
export declare function filterAndEnrichStates(states: readonly HomeAssistantState[], config: PluginConfig, registry: RegistrySnapshot, filters: EntityListFilters): {
    count: number;
    matched: number;
    truncated: boolean;
    entities: CompactEntityState[];
};
