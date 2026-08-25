# Home Assistant Safe for OpenClaw

A least-privilege Home Assistant plugin for OpenClaw. It lets an agent read approved entities, discover them by domain, device class, or area, and optionally turn on or turn off explicitly approved entities.

## Tools

- `ha_get_state` reads one approved entity.
- `ha_list_entities` lists approved entities and supports `domain`, `deviceClass`, and `area` filters.
- `ha_turn_on` turns on an explicitly writable entity.
- `ha_turn_off` turns off an explicitly writable entity.

Write access is disabled unless `writableEntities` is configured. `blockedEntities` always overrides read and write permissions.

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
          "media_player.living_room_tv"
        ],
        writableEntities: [
          "light.living_room_ceiling",
          "media_player.living_room_tv"
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

Configuration options:

- `url`: Home Assistant base URL.
- `tokenFile`: path to a file containing a Home Assistant Long-Lived Access Token.
- `readableEntities`: entity IDs or simple wildcard patterns allowed for reads.
- `writableEntities`: entity IDs or wildcard patterns allowed for power control. The default is read-only.
- `blockedEntities`: entity IDs or wildcard patterns that are always denied.
- `requestTimeoutMs`: timeout for Home Assistant requests.
- `registryCacheTtlMs`: how long device and area information is cached. Set it to `0` to disable caching.

The token file must be a regular, non-symlink file with permissions `0600` or stricter. Use a dedicated non-admin Home Assistant user.

For a read-only `home` agent, the OpenClaw tool policy can include:

```json5
tools: {
  alsoAllow: ["ha_get_state", "ha_list_entities"]
}
```

## Area discovery

Entities inherit their device area when they do not have an area assigned directly. Area filters match an exact area ID, name, or configured alias without case sensitivity. Fuzzy or automatic translation matching is not performed.

Example request:

```json
{
  "domain": "sensor",
  "deviceClass": "temperature",
  "area": "Living Room",
  "limit": 50
}
```

Example result:

```json
{
  "count": 1,
  "matched": 1,
  "truncated": false,
  "entities": [
    {
      "entity_id": "sensor.living_room_temperature",
      "state": "25.59",
      "friendly_name": "Temperature",
      "device_class": "temperature",
      "unit_of_measurement": "°C",
      "device_name": "Thermometer",
      "area_id": "living_room",
      "area_name": "Living Room"
    }
  ]
}
```

## Development

Requires Node.js 24.15 or later.

```bash
npm install
npm run check
npm pack --dry-run
```

Use `npm run plugin:build` after changing plugin tools, configuration, or metadata. It compiles the TypeScript source and refreshes the generated OpenClaw metadata.

For a linked local installation:

```bash
npm run plugin:build
openclaw plugins install --link .
```
