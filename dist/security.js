import { lstat, readFile } from "node:fs/promises";
export function patternMatches(pattern, entityId) {
    if (pattern === entityId || pattern === "*")
        return true;
    const star = pattern.indexOf("*");
    if (star === -1)
        return false;
    const prefix = pattern.slice(0, star);
    const suffix = pattern.slice(star + 1);
    return entityId.startsWith(prefix) && entityId.endsWith(suffix);
}
function matchesAny(patterns, entityId) {
    return (patterns ?? []).some((pattern) => patternMatches(pattern, entityId));
}
function compilePattern(pattern) {
    if (pattern === "*")
        return () => true;
    const star = pattern.indexOf("*");
    if (star === -1)
        return (entityId) => entityId === pattern;
    const prefix = pattern.slice(0, star);
    const suffix = pattern.slice(star + 1);
    return (entityId) => entityId.startsWith(prefix) && entityId.endsWith(suffix);
}
function compilePatterns(patterns) {
    const matchers = (patterns ?? []).map(compilePattern);
    return (entityId) => matchers.some((matches) => matches(entityId));
}
export function createEntityAccessPolicy(config) {
    const matchesBlocked = compilePatterns(config.blockedEntities);
    const matchesReadable = compilePatterns(config.readableEntities);
    const matchesWritable = compilePatterns(config.writableEntities);
    const isBlockedByPolicy = (entityId) => matchesBlocked(entityId);
    return {
        isBlocked: isBlockedByPolicy,
        canRead: (entityId) => !isBlockedByPolicy(entityId) && matchesReadable(entityId),
        canWrite: (entityId) => !isBlockedByPolicy(entityId) && matchesWritable(entityId),
    };
}
export function isBlocked(config, entityId) {
    return matchesAny(config.blockedEntities, entityId);
}
export function canRead(config, entityId) {
    return !isBlocked(config, entityId) && matchesAny(config.readableEntities, entityId);
}
export function canWrite(config, entityId) {
    return !isBlocked(config, entityId) && matchesAny(config.writableEntities, entityId);
}
export async function loadToken(tokenFile) {
    const info = await lstat(tokenFile);
    if (!info.isFile() || info.isSymbolicLink()) {
        throw new Error("Home Assistant tokenFile must be a regular non-symlink file");
    }
    if ((info.mode & 0o077) !== 0) {
        throw new Error("Home Assistant tokenFile permissions are too broad; require mode 0600 or stricter");
    }
    const token = (await readFile(tokenFile, "utf8")).trim();
    if (!token)
        throw new Error("Home Assistant token file is empty");
    return token;
}
//# sourceMappingURL=security.js.map