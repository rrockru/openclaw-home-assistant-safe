import type { PluginConfig } from "./types.js";
export declare function patternMatches(pattern: string, entityId: string): boolean;
export declare function isBlocked(config: PluginConfig, entityId: string): boolean;
export declare function canRead(config: PluginConfig, entityId: string): boolean;
export declare function canWrite(config: PluginConfig, entityId: string): boolean;
export declare function loadToken(tokenFile: string): Promise<string>;
//# sourceMappingURL=security.d.ts.map