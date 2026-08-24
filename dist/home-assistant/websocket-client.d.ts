import type { PluginConfig } from "../types.js";
interface HaWsCommand {
    type: string;
    [key: string]: unknown;
}
export declare function haWebSocketCommands<T extends readonly unknown[]>(config: PluginConfig, commands: readonly HaWsCommand[], signal?: AbortSignal): Promise<T>;
export {};
//# sourceMappingURL=websocket-client.d.ts.map