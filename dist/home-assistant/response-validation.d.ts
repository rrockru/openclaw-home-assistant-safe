import type { AreaRegistryEntry, DeviceRegistryEntry, EntityRegistryEntry, HomeAssistantState } from "../types.js";
export declare function parseState(value: unknown): HomeAssistantState;
export declare function parseStates(value: unknown): HomeAssistantState[];
export declare function parseEntityRegistry(value: unknown): EntityRegistryEntry[];
export declare function parseDeviceRegistry(value: unknown): DeviceRegistryEntry[];
export declare function parseAreaRegistry(value: unknown): AreaRegistryEntry[];
