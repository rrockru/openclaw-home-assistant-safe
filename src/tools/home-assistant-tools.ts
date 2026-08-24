import { Type } from "typebox";
import type { PluginConfig } from "../types.js";
import { filterAndEnrichStates } from "../home-assistant/entities.js";
import { getRegistrySnapshot } from "../home-assistant/registry.js";
import { listStates } from "../home-assistant/rest-client.js";
import { callPowerService, getState } from "../home-assistant/state.js";

export function homeAssistantTools(tool: any) {
  return [
    tool({
      name: "ha_get_state",
      label: "Home Assistant Get State",
      description: "Read the current state of one explicitly allowed Home Assistant entity.",
      parameters: Type.Object(
        { entity_id: Type.String({ description: "Exact Home Assistant entity_id." }) },
        { additionalProperties: false },
      ),
      async execute({ entity_id }: { entity_id: string }, config: PluginConfig, context: { signal?: AbortSignal }) {
        context.signal?.throwIfAborted();
        return await getState(config, entity_id, context.signal);
      },
    }),
    tool({
      name: "ha_list_entities",
      label: "Home Assistant List Entities",
      description:
        "List readable Home Assistant entities, enriched with device and area metadata. Filter by domain, device class, and area to minimize returned data.",
      parameters: Type.Object(
        {
          domain: Type.Optional(Type.String({ description: "Exact Home Assistant domain, for example sensor or light." })),
          deviceClass: Type.Optional(
            Type.String({ description: "Exact device_class, for example temperature, humidity, or battery." }),
          ),
          area: Type.Optional(
            Type.String({
              description: "Exact area id, name, or configured area alias. Matching is case-insensitive but not fuzzy.",
            }),
          ),
          limit: Type.Optional(
            Type.Integer({ minimum: 1, maximum: 500, default: 200, description: "Maximum entities returned." }),
          ),
        },
        { additionalProperties: false },
      ),
      async execute(
        args: { domain?: string; deviceClass?: string; area?: string; limit?: number },
        config: PluginConfig,
        context: { signal?: AbortSignal },
      ) {
        context.signal?.throwIfAborted();
        const states = await listStates(config, context.signal);
        const registry = await getRegistrySnapshot(config, context.signal);
        return filterAndEnrichStates(states, config, registry, args);
      },
    }),
    tool({
      name: "ha_turn_on",
      label: "Home Assistant Turn On",
      description: "Turn on one explicitly writable Home Assistant entity. Fails closed outside the write ACL.",
      parameters: Type.Object(
        { entity_id: Type.String({ description: "Exact Home Assistant entity_id." }) },
        { additionalProperties: false },
      ),
      async execute({ entity_id }: { entity_id: string }, config: PluginConfig, context: { signal?: AbortSignal }) {
        context.signal?.throwIfAborted();
        return await callPowerService(config, entity_id, "turn_on", context.signal);
      },
    }),
    tool({
      name: "ha_turn_off",
      label: "Home Assistant Turn Off",
      description: "Turn off one explicitly writable Home Assistant entity. Fails closed outside the write ACL.",
      parameters: Type.Object(
        { entity_id: Type.String({ description: "Exact Home Assistant entity_id." }) },
        { additionalProperties: false },
      ),
      async execute({ entity_id }: { entity_id: string }, config: PluginConfig, context: { signal?: AbortSignal }) {
        context.signal?.throwIfAborted();
        return await callPowerService(config, entity_id, "turn_off", context.signal);
      },
    }),
  ];
}
