# Home Assistant Safe for OpenClaw

A small Home Assistant tool plugin for OpenClaw designed around least privilege. It exposes explicit read and power-control tools, applies entity ACLs before returning data to the model, and enriches entity discovery with Home Assistant device and area metadata.

## Tools

- `ha_get_state` reads one entity allowed by `readableEntities`.
- `ha_list_entities` discovers readable entities and can filter by `domain`, `deviceClass`, and `area`.
- `ha_turn_on` turns on one entity allowed by `writableEntities`.
- `ha_turn_off` turns off one entity allowed by `writableEntities`.

`blockedEntities` always overrides both allowlists. Wildcard matching is intentionally simple; examples include `sensor.*`, `light.*`, and `media_player.lg_*`.

`ha_list_entities` joins current states from the Home Assistant REST API with the entity, device, and area registries from the Home Assistant WebSocket API. Area resolution follows Home Assistant semantics: an entity-level area overrides its device area. Area filters match an exact area id, name, or configured alias case-insensitively; fuzzy matching is intentionally not performed.

Registry metadata is cached for five minutes by default (`registryCacheTtlMs: 300000`). Current entity states are never served from that cache.

## Security model

- No arbitrary Home Assistant service calls.
- No arbitrary registry commands; the WebSocket client only issues the three read-only registry list commands needed for discovery.
- No arbitrary filesystem access other than reading the configured token file.
- No shell execution.
- No runtime dependencies other than `typebox` and the OpenClaw peer dependency.
- The write ACL defaults to empty/read-only.
- ACL filtering happens before registry metadata is returned to the model.
- `blockedEntities` overrides every allow rule.
- The token file must be a regular non-symlink file with mode `0600` or stricter.
- Use a dedicated non-admin Home Assistant user and Long-Lived Access Token.

## Configuration

```json5
plugins: {
  entries: {
    "home-assistant-safe": {
      enabled: true,
      config: {
        url: "http://192.168.1.30:8123",
        tokenFile: "/var/lib/openclaw/.openclaw/secrets/home-assistant-token",
        readableEntities: [
          "sensor.*",
          "binary_sensor.*",
          "light.*",
          "media_player.lg_webos_smart_tv"
        ],
        writableEntities: [
          "light.da760786297ef146e0136152160280a0",
          "media_player.lg_webos_smart_tv"
        ],
        blockedEntities: [
          "lock.*",
          "alarm_control_panel.*"
        ],
        requestTimeoutMs: 8000,
        registryCacheTtlMs: 300000
      }
    }
  }
}
```

For a read-only `home` agent, a suitable OpenClaw policy is:

```json5
tools: {
  alsoAllow: ["ha_get_state", "ha_list_entities"],
  deny: ["exec", "process", "write", "edit", "apply_patch", "browser"]
}
```

## Local development

Requirements follow the current OpenClaw tool-plugin SDK: Node 24.15+ is recommended, TypeScript ESM output is built into `dist/`, and the published package ships compiled JavaScript rather than a TypeScript runtime entry.

```bash
npm install
npm run plugin:build
npm run plugin:validate
npm test
```

`npm run plugin:build` performs both steps that used to be manual:

1. compiles TypeScript into `dist/`;
2. runs `openclaw plugins build --root . --entry ./dist/index.js`, regenerating `openclaw.plugin.json` and aligning the OpenClaw package metadata.

You therefore do not need to run `openclaw plugins build` separately after changing tool names, plugin metadata, or the config schema.

Before publication, `npm pack` / `npm publish` automatically runs `prepack`, which validates generated OpenClaw metadata and executes the tests. CI additionally runs `openclaw plugins build --check`, so a pull request fails if committed generated metadata is stale.

## Local linked installation

Build the plugin on the development host, then link the reviewed directory:

```bash
npm install
npm run plugin:build
openclaw plugins install --link .
```

After configuration or plugin updates, restart the Gateway and verify effective tool policy:

```bash
openclaw plugins inspect home-assistant-safe --runtime --json
openclaw gateway call tools.catalog --params '{"agentId":"home","includePlugins":true}' --json
openclaw gateway call tools.effective --params '{"sessionKey":"agent:home:main"}' --json
```

## Example discovery

A model can now request only the data it needs:

```json
{
  "domain": "sensor",
  "deviceClass": "temperature",
  "area": "Guestroom"
}
```

A matching result includes current state plus resolved device and area context:

```json
{
  "entity_id": "sensor.example_temperature",
  "state": "25.59",
  "friendly_name": "Temperature",
  "device_class": "temperature",
  "unit_of_measurement": "°C",
  "device_id": "...",
  "device_name": "Thermometer",
  "area_id": "living_room",
  "area_name": "Guestroom",
  "area_aliases": ["Living room"]
}
```
