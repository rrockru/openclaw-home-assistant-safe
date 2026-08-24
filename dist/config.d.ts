import type { PluginConfig } from "./types.js";
export declare const configSchema: any;
export declare function requireConfigured(config: PluginConfig): asserts config is PluginConfig & {
    url: string;
    tokenFile: string;
};
export declare function normalizeBaseUrl(url: string): string;
export declare function webSocketUrl(url: string): string;
//# sourceMappingURL=config.d.ts.map