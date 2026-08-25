# Home Assistant Safe for OpenClaw

Home Assistant Safe is a least-privilege OpenClaw tool plugin. It lets an agent read explicitly approved Home Assistant entities, discover them by domain, device class, or area, and optionally turn on or turn off a narrow set of approved entities.

The plugin intentionally does not expose arbitrary Home Assistant service calls, shell commands, SSH, or filesystem access. Write access is disabled until `writableEntities` is configured.

## Architecture

OpenClaw loads the compiled ESM entry at `dist/index.js` and registers four tools:

- `ha_get_state` reads one entity allowed by `readableEntities`.
- `ha_list_entities` lists readable entities and composes `domain`, `deviceClass`, and `area` filters.
- `ha_turn_on` turns on one entity allowed by `writableEntities`.
- `ha_turn_off` turns off one entity allowed by `writableEntities`.

Current states come from the Home Assistant REST API. Entity, device, and area registries come from three fixed, read-only WebSocket commands. Registry metadata is cached in memory with a configurable TTL; current states are never served from that cache.

## Security model

Security has three layers:

1. OpenClaw tool policy controls whether an agent can see or invoke these tools.
2. This plugin applies `readableEntities`, `writableEntities`, and `blockedEntities` before returning data or changing state.
3. The Home Assistant user and token provide the upstream permission boundary.

`blockedEntities` always overrides both allowlists. Read and write permissions are independent: making an entity readable does not make it writable, and making it writable does not automatically return its state.

Each direct read or write accepts exactly one canonical lowercase `domain.object_id`. Comma-separated, whitespace-padded, uppercase, and otherwise malformed IDs are rejected before ACL evaluation. This prevents Home Assistant from normalizing one authorized string into multiple or different targets.

Important limitations:

- A writable scene, script, group, or similar aggregate can affect other entities through Home Assistant's own configuration. Treat permission to such an entity as permission to all of its transitive effects.
- A readable group, template, or helper may expose related entity IDs or derived data in its attributes. Block rules prevent direct reads; they cannot redact content Home Assistant embeds inside a different allowed entity.
- The OpenClaw process and configured Home Assistant token can access more upstream data than the model receives. Use a dedicated, non-admin Home Assistant user and expose only the entities it needs.
- Prefer HTTPS/WSS for any connection that crosses an untrusted network. Plain HTTP/WS sends the long-lived token without transport encryption.

See [SECURITY.md](SECURITY.md) for the threat model, credential requirements, and vulnerability-reporting process.

## Requirements

- OpenClaw `2026.5.17` or later.
- Node.js `24.15.0` or later.
- A Home Assistant Long-Lived Access Token stored in a private local file.

The package follows the current OpenClaw tool-plugin contract: TypeScript ESM output, `defineToolPlugin` from `openclaw/plugin-sdk/tool-plugin`, `typebox` as a runtime dependency, and generated `openclaw.plugin.json` metadata.

## Create a Home Assistant token

1. Create a dedicated non-admin Home Assistant user for this integration.
2. Sign in as that user, open its profile, and create a Long-Lived Access Token.
3. Write only the token to a file owned by the OpenClaw service account.
4. Set the file mode to `0600` and keep its parent directory non-writable by untrusted users.

Example:

```bash
install -d -m 0700 /var/lib/openclaw/.openclaw/secrets
install -m 0600 /dev/null /var/lib/openclaw/.openclaw/secrets/home-assistant-token
```

Then write the token through your normal secret-management process. Do not put it in `openclaw.json`, source control, shell history, logs, or prompts.

## Install from npm

After reviewing the release and its changelog, install the public scoped package directly from npm:

```bash
openclaw plugins install npm:@rrock/home-assistant-safe
```

For reproducible production deployments, pin an exact reviewed version, for example `npm:@rrock/home-assistant-safe@0.2.0`. Restart the Gateway after installation, then inspect the effective runtime registration:

```bash
openclaw plugins inspect home-assistant-safe --runtime --json
```

The npm package name is scoped, but the OpenClaw plugin ID remains `home-assistant-safe`.

## Install from a local path

On a development machine:

```bash
npm ci --ignore-scripts
npm run check
openclaw plugins install --link .
```

For a production path deployment, use the reviewed checkout or release archive. Committed `dist/` means TypeScript and build tooling are not required on the production host. Runtime dependencies still must exist locally:

```bash
npm ci --omit=dev --ignore-scripts
openclaw plugins install --link .
```

The `--ignore-scripts` flag prevents dependency lifecycle scripts from running. Restart the Gateway after installation or updates, then inspect the effective runtime registration:

```bash
openclaw plugins inspect home-assistant-safe --runtime --json
```

## Configure the plugin

```json5
plugins: {
  entries: {
    "home-assistant-safe": {
      enabled: true,
      config: {
        url: "http://192.168.1.30:8123",
        tokenFile: "/var/lib/openclaw/.openclaw/secrets/home-assistant-token",
        readableEntities: ["sensor.*", "binary_sensor.*", "light.*", "media_player.living_room_tv"],
        writableEntities: ["light.living_room_ceiling", "media_player.living_room_tv"],
        blockedEntities: ["lock.*", "alarm_control_panel.*", "sensor.secret_*"],
        requestTimeoutMs: 8000,
        registryCacheTtlMs: 300000,
      },
    },
  },
}
```

Configuration fields:

- `url`: Home Assistant base URL using `http` or `https`.
- `tokenFile`: private regular, non-symlink token file with mode `0600` or stricter.
- `readableEntities`: exact entity IDs or simple patterns with at most one `*`.
- `writableEntities`: exact IDs or patterns allowed for `turn_on` and `turn_off`; empty by default.
- `blockedEntities`: exact IDs or patterns always denied; block rules take precedence.
- `requestTimeoutMs`: REST and WebSocket timeout, from 1,000 to 30,000 ms; default 8,000.
- `registryCacheTtlMs`: registry cache TTL, from 0 to 3,600,000 ms; default 300,000. Set `0` to refresh every time.

ACL examples:

```json5
readableEntities: ["sensor.*", "light.kitchen_*", "media_player.living_room_tv"]
writableEntities: ["light.kitchen_ceiling"]
blockedEntities: ["sensor.secret_*", "light.kitchen_lock", "lock.*"]
```

With this configuration, `sensor.secret_token` is not readable even though `sensor.*` allows the domain. `light.kitchen_lock` cannot be read or written even though it matches an allow pattern. `light.kitchen_ceiling` is writable, while other readable kitchen lights remain read-only.

For a read-only agent, also restrict the outer OpenClaw policy:

```json5
tools: {
  alsoAllow: ["ha_get_state", "ha_list_entities"],
}
```

## Area-aware discovery

`ha_list_entities` joins states with the entity, device, and area registries. Area resolution follows this order:

1. `entity.area_id`, when assigned;
2. `device.area_id`, as a fallback;
3. no area metadata.

Entities without an area remain usable and appear in unfiltered results. An area filter matches an exact area ID, name, or configured alias case-insensitively. It is not fuzzy. Domain, device-class, and area filters compose; an entity must satisfy every supplied filter.

```json
{
  "domain": "sensor",
  "deviceClass": "temperature",
  "area": "Living Room",
  "limit": 50
}
```

The result reports `count`, total `matched`, and `truncated`. `limit` is bounded to 1–500 and defaults to 200.

## Update a production path installation

1. Stop or drain the OpenClaw Gateway according to your deployment procedure.
2. Replace the checkout with the reviewed release, including committed `dist/`, `package-lock.json`, and `openclaw.plugin.json`.
3. Run `npm ci --omit=dev --ignore-scripts` to refresh runtime dependencies.
4. Start the Gateway and run `openclaw plugins inspect home-assistant-safe --runtime --json`.

Review [CHANGELOG.md](CHANGELOG.md) before updating. Version 0.2.0 keeps the four tool names and existing configuration keys.

## Development and release checks

```bash
npm ci --ignore-scripts
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
npm run plugin:metadata:check
npm run plugin:validate
npm pack --dry-run --ignore-scripts
```

`npm run plugin:build` compiles source and regenerates `openclaw.plugin.json` from `dist/index.js`. The generated manifest and committed `dist/` are authoritative build outputs; do not edit them manually. CI runs the local, explicitly installed OpenClaw CLI with:

```bash
npm exec -- openclaw plugins build --root . --entry ./dist/index.js --check
```

The build emits JavaScript and declarations without source maps or local source paths.

## Troubleshooting

- **Plugin is not listed:** run `npm ci --omit=dev --ignore-scripts`, verify `dist/index.js` exists, then inspect the plugin runtime.
- **Plugin metadata is stale:** on a development machine run `npm run plugin:build` and commit `openclaw.plugin.json`, `package.json`, and `dist/` together.
- **Not configured:** set both `url` and `tokenFile` in the plugin entry.
- **Token file rejected:** confirm it is a regular file, not a symlink, and has no group/other permission bits.
- **401 or WebSocket authentication failure:** create a new token for the dedicated Home Assistant user and replace the token file securely.
- **Request timed out:** verify routing and the URL, then adjust `requestTimeoutMs` within the supported range. Do not remove timeouts.
- **Area filter returns nothing:** check the exact area ID, name, or alias. Entity-level area assignment overrides device area.
- **Access denied:** compare the canonical lowercase entity ID against all three ACL lists; a matching block always wins.
