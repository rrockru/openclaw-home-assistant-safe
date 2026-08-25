import { constants } from "node:fs";
import { open } from "node:fs/promises";
export const HOME_ASSISTANT_ENTITY_ID_PATTERN = "^[a-z0-9_]+\\.[a-z0-9_]+$";
const ENTITY_ID_PATTERN = new RegExp(HOME_ASSISTANT_ENTITY_ID_PATTERN);
export function requireCanonicalEntityId(entityId) {
    if (!ENTITY_ID_PATTERN.test(entityId)) {
        throw new Error("Invalid Home Assistant entity_id: expected one lowercase domain.object_id value");
    }
    return entityId;
}
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
    let handle;
    try {
        handle = await open(tokenFile, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    }
    catch (error) {
        if (error.code === "ELOOP") {
            throw new Error("Home Assistant tokenFile must be a regular non-symlink file", { cause: error });
        }
        throw error;
    }
    try {
        const info = await handle.stat();
        if (!info.isFile()) {
            throw new Error("Home Assistant tokenFile must be a regular non-symlink file");
        }
        if ((info.mode & 0o077) !== 0) {
            throw new Error("Home Assistant tokenFile permissions are too broad; require mode 0600 or stricter");
        }
        const token = (await handle.readFile("utf8")).trim();
        if (!token)
            throw new Error("Home Assistant token file is empty");
        return token;
    }
    finally {
        await handle.close();
    }
}
