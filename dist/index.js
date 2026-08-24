import { lstat, readFile } from "node:fs/promises";
import { Type } from "typebox";
import { defineToolPlugin } from "openclaw/plugin-sdk/tool-plugin";

const configSchema = Type.Object({
  url: Type.Optional(Type.String({ description: "Home Assistant base URL." })),
  tokenFile: Type.Optional(Type.String({ description: "Path to Home Assistant token file." })),
  readableEntities: Type.Optional(Type.Array(Type.String(), { default: [] })),
  writableEntities: Type.Optional(Type.Array(Type.String(), { default: [] })),
  blockedEntities: Type.Optional(Type.Array(Type.String(), { default: [] })),
  requestTimeoutMs: Type.Optional(Type.Integer({ minimum: 1000, maximum: 30000, default: 8000 })),
}, { additionalProperties: false });

function requireConfigured(config) {
  if (!config?.url || !config?.tokenFile) {
    throw new Error("Home Assistant Safe is not configured: set plugins.entries.home-assistant-safe.config.url and tokenFile");
  }
}

function normalizeBaseUrl(url) {
  return url.replace(/\/+$/, "");
}

function patternMatches(pattern, entityId) {
  if (pattern === entityId || pattern === "*") return true;
  const star = pattern.indexOf("*");
  if (star === -1) return false;
  const prefix = pattern.slice(0, star);
  const suffix = pattern.slice(star + 1);
  return entityId.startsWith(prefix) && entityId.endsWith(suffix);
}

function matchesAny(patterns, entityId) {
  return (patterns ?? []).some((p) => patternMatches(p, entityId));
}

function isBlocked(config, entityId) {
  return matchesAny(config.blockedEntities ?? [], entityId);
}

function canRead(config, entityId) {
  return !isBlocked(config, entityId) && matchesAny(config.readableEntities ?? [], entityId);
}

function canWrite(config, entityId) {
  return !isBlocked(config, entityId) && matchesAny(config.writableEntities ?? [], entityId);
}

async function loadToken(tokenFile) {
  const info = await lstat(tokenFile);
  if (!info.isFile() || info.isSymbolicLink()) {
    throw new Error("Home Assistant tokenFile must be a regular non-symlink file");
  }
  if ((info.mode & 0o077) !== 0) {
    throw new Error("Home Assistant tokenFile permissions are too broad; require mode 0600 or stricter");
  }
  const token = (await readFile(tokenFile, "utf8")).trim();
  if (!token) throw new Error("Home Assistant token file is empty");
  return token;
}

async function haRequest(config, path, options = {}, signal) {
  requireConfigured(config);
  const parsedUrl = new URL(config.url);
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error("Home Assistant url must use http or https");
  }
  const token = await loadToken(config.tokenFile);
  const timeoutMs = config.requestTimeoutMs ?? 8000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("Home Assistant request timed out")), timeoutMs);
  const onAbort = () => controller.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) controller.abort(signal.reason);
    else signal.addEventListener("abort", onAbort, { once: true });
  }

  try {
    const response = await fetch(`${normalizeBaseUrl(config.url)}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
      },
    });

    const text = await response.text();
    let body = null;
    if (text) {
      try { body = JSON.parse(text); } catch { body = text; }
    }

    if (!response.ok) {
      throw new Error(`Home Assistant API ${response.status}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
    }
    return body;
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", onAbort);
  }
}

function slimState(state) {
  return {
    entity_id: state.entity_id,
    state: state.state,
    attributes: state.attributes ?? {},
    last_changed: state.last_changed,
    last_updated: state.last_updated,
  };
}

function compactState(state) {
  const attrs = state.attributes ?? {};
  return {
    entity_id: state.entity_id,
    state: state.state,
    friendly_name: attrs.friendly_name ?? null,
    device_class: attrs.device_class ?? null,
    unit_of_measurement: attrs.unit_of_measurement ?? null,
  };
}

async function getState(config, entityId, signal) {
  if (!canRead(config, entityId)) {
    throw new Error(`Read access denied for entity: ${entityId}`);
  }
  const state = await haRequest(config, `/api/states/${encodeURIComponent(entityId)}`, {}, signal);
  return slimState(state);
}

async function callPowerService(config, entityId, service, signal) {
  if (!canWrite(config, entityId)) {
    throw new Error(`Write access denied for entity: ${entityId}`);
  }
  const domain = entityId.split(".", 1)[0];
  if (!domain || !entityId.includes(".")) throw new Error("Invalid Home Assistant entity_id");

  await haRequest(
    config,
    `/api/services/${encodeURIComponent(domain)}/${service}`,
    { method: "POST", body: JSON.stringify({ entity_id: entityId }) },
    signal,
  );

  let resultingState = null;
  try {
    if (canRead(config, entityId)) resultingState = await getState(config, entityId, signal);
  } catch {
    // The service call succeeded; a follow-up state read is best-effort only.
  }

  return {
    ok: true,
    entity_id: entityId,
    service,
    resulting_state: resultingState,
  };
}

export default defineToolPlugin({
  id: "home-assistant-safe",
  name: "Home Assistant Safe",
  description: "Least-privilege Home Assistant tools with entity-level ACLs.",
  configSchema,
  tools: (tool) => [
    tool({
      name: "ha_get_state",
      label: "Home Assistant Get State",
      description: "Read the current state of one explicitly allowed Home Assistant entity.",
      parameters: Type.Object({
        entity_id: Type.String({ description: "Exact Home Assistant entity_id." }),
      }, { additionalProperties: false }),
      async execute({ entity_id }, config, context) {
        context.signal?.throwIfAborted();
        return await getState(config, entity_id, context.signal);
      },
    }),
    tool({
      name: "ha_list_entities",
      label: "Home Assistant List Entities",
      description: "List Home Assistant entities visible through the configured read ACL, optionally restricted to one domain.",
      parameters: Type.Object({
        domain: Type.Optional(Type.String({ description: "Optional domain such as light, sensor, or media_player." })),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 500, default: 200, description: "Maximum entities returned." })),
      }, { additionalProperties: false }),
      async execute({ domain, limit }, config, context) {
        context.signal?.throwIfAborted();
        const states = await haRequest(config, "/api/states", {}, context.signal);
        const visible = states
          .filter((s) => canRead(config, s.entity_id))
          .filter((s) => !domain || s.entity_id.startsWith(`${domain}.`))
          .slice(0, limit ?? 200)
          .map(compactState);
        return { count: visible.length, entities: visible };
      },
    }),
    tool({
      name: "ha_turn_on",
      label: "Home Assistant Turn On",
      description: "Turn on one explicitly writable Home Assistant entity. Fails closed for entities outside the write ACL.",
      parameters: Type.Object({
        entity_id: Type.String({ description: "Exact Home Assistant entity_id." }),
      }, { additionalProperties: false }),
      async execute({ entity_id }, config, context) {
        context.signal?.throwIfAborted();
        return await callPowerService(config, entity_id, "turn_on", context.signal);
      },
    }),
    tool({
      name: "ha_turn_off",
      label: "Home Assistant Turn Off",
      description: "Turn off one explicitly writable Home Assistant entity. Fails closed for entities outside the write ACL.",
      parameters: Type.Object({
        entity_id: Type.String({ description: "Exact Home Assistant entity_id." }),
      }, { additionalProperties: false }),
      async execute({ entity_id }, config, context) {
        context.signal?.throwIfAborted();
        return await callPowerService(config, entity_id, "turn_off", context.signal);
      },
    }),
  ],
});
