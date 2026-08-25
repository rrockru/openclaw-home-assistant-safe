import type { PluginConfig } from "./types.js";
export interface EntityAccessPolicy {
    canRead(entityId: string): boolean;
    canWrite(entityId: string): boolean;
    isBlocked(entityId: string): boolean;
}
export declare const HOME_ASSISTANT_ENTITY_ID_PATTERN = "^[a-z0-9_]+\\.[a-z0-9_]+$";
export declare function requireCanonicalEntityId(entityId: string): string;
export declare function patternMatches(pattern: string, entityId: string): boolean;
export declare function createEntityAccessPolicy(config: PluginConfig): EntityAccessPolicy;
export declare function isBlocked(config: PluginConfig, entityId: string): boolean;
export declare function canRead(config: PluginConfig, entityId: string): boolean;
export declare function canWrite(config: PluginConfig, entityId: string): boolean;
export declare function loadToken(tokenFile: string): Promise<string>;
