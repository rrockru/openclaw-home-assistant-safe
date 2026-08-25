import type { PluginConfig, RegistrySnapshot } from "../types.js";
export declare function getRegistrySnapshot(config: PluginConfig, signal?: AbortSignal): Promise<RegistrySnapshot>;
export declare function clearRegistryCache(): void;
