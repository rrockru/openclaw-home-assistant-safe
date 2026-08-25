import type { PluginConfig } from "../types.js";
interface HaWsCommand {
    type: string;
    [key: string]: unknown;
}
export declare function haWebSocketCommands(config: PluginConfig, commands: readonly HaWsCommand[], signal?: AbortSignal): Promise<unknown[]>;
export {};
