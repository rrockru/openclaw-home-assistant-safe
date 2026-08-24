import type { HomeAssistantState, PluginConfig } from "../types.js";
export declare function haRequest<T>(config: PluginConfig, path: string, options?: RequestInit, signal?: AbortSignal): Promise<T>;
export declare function listStates(config: PluginConfig, signal?: AbortSignal): Promise<HomeAssistantState[]>;
export declare function readState(config: PluginConfig, entityId: string, signal?: AbortSignal): Promise<HomeAssistantState>;
//# sourceMappingURL=rest-client.d.ts.map