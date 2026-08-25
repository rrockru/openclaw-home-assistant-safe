import { Type } from "typebox";
import type { PluginConfig } from "./types.js";
export declare const configSchema: Type.TObject<{
    url: Type.TOptional<Type.TString>;
    tokenFile: Type.TOptional<Type.TString>;
    readableEntities: Type.TOptional<Type.TArray<Type.TString>>;
    writableEntities: Type.TOptional<Type.TArray<Type.TString>>;
    blockedEntities: Type.TOptional<Type.TArray<Type.TString>>;
    requestTimeoutMs: Type.TOptional<Type.TInteger>;
    registryCacheTtlMs: Type.TOptional<Type.TInteger>;
}>;
export declare function requireConfigured(config: PluginConfig): asserts config is PluginConfig & {
    url: string;
    tokenFile: string;
};
export declare function normalizeBaseUrl(url: string): string;
export declare function webSocketUrl(url: string): string;
