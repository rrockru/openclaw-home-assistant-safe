# Home Assistant Safe for OpenClaw

Minimal Home Assistant tool plugin designed for least privilege.

## Tools

- `ha_get_state` - read one entity allowed by `readableEntities`
- `ha_list_entities` - list only entities allowed by `readableEntities`
- `ha_turn_on` - turn on one entity allowed by `writableEntities`
- `ha_turn_off` - turn off one entity allowed by `writableEntities`

`blockedEntities` always wins over both allowlists.

Wildcard matching is intentionally simple. Examples: `sensor.*`, `light.*`, `media_player.lg_*`.

## Security model

- No arbitrary Home Assistant service calls.
- No arbitrary filesystem access other than reading the configured token file.
- No shell execution.
- No external runtime dependencies except `typebox`.
- Write ACL defaults to empty/read-only.
- Use a dedicated non-admin Home Assistant user and token.
- Protect the token file with mode `0600` and ownership by the OpenClaw service account.

## Install

Copy this directory to the OpenClaw host. Local plugins must bring their own runtime dependencies, so install only `typebox` and deliberately ignore peer auto-install/build scripts:

```bash
npm install --omit=dev --ignore-scripts --legacy-peer-deps
~/.openclaw/bin/openclaw plugins install -l ./ --force
```

`--link` keeps the reviewed local directory as the source and avoids the managed npm plugin root.

Inspect and add `home-assistant-safe` to `plugins.allow`, then configure it and restart the Gateway.

## Example config

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
        requestTimeoutMs: 8000
      }
    }
  }
}
```

For the `home` agent, allow only the four `ha_*` tools you intend to expose and continue denying `exec`, `process`, `browser`, `write`, `edit`, and `apply_patch`.

## Validate before enabling

```bash
~/.openclaw/bin/openclaw plugins validate --root . --entry ./dist/index.js
~/.openclaw/bin/openclaw plugins inspect home-assistant-safe --runtime
```

The plugin deliberately rejects a token file that is a symlink or has any group/world permission bits. Use mode `0600`.
