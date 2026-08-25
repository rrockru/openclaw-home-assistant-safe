import type { PluginConfig } from "../types.js";
export declare function getState(config: PluginConfig, entityId: string, signal?: AbortSignal): Promise<{
    entity_id: string;
    state: string;
    attributes: Record<string, unknown>;
    last_changed: string | undefined;
    last_updated: string | undefined;
}>;
export declare function callPowerService(config: PluginConfig, entityId: string, service: "turn_on" | "turn_off", signal?: AbortSignal): Promise<{
    ok: boolean;
    entity_id: string;
    service: "turn_on" | "turn_off";
    resulting_state: {
        entity_id: string;
        state: string;
        attributes: Record<string, unknown>;
        last_changed: string | undefined;
        last_updated: string | undefined;
    } | null;
}>;
