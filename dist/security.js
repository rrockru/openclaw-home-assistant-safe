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