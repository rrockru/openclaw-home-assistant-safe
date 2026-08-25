# Changelog

All notable changes to this project are documented here. The project follows Semantic Versioning.

## [0.2.0] - 2026-08-25

### Added

- Area-aware discovery using Home Assistant entity, device, and area registries.
- Entity-area precedence with device-area fallback and support for entities without an area.
- Composable domain, device-class, and exact area ID/name/alias filters.
- Bounded list results with explicit `matched` and `truncated` metadata.
- Predictable, bounded registry caching with concurrent refresh coalescing and configurable TTL.
- Strict TypeScript, ESLint, Prettier, expanded transport/ACL/cache/entity tests, and deterministic CI.
- Public-user installation, production update, threat-model, and vulnerability-reporting documentation.

### Security

- Enforced one canonical lowercase Home Assistant entity ID before ACL checks. This prevents comma-separated or normalization-based targets from causing Home Assistant to act on blocked entities.
- Preserved block-overrides-allow behavior and independent read/write ACLs on every tool path.
- Changed token loading to open, inspect, and read the same non-symlink file descriptor.
- Added runtime validation for REST state and WebSocket registry responses.
- Bounded REST response bodies and upstream error details.
- Ensured internal request options cannot replace the configured bearer credential.

### Changed

- Build output no longer includes source maps or declaration maps.
- The public npm package is published under the `@rrock/home-assistant-safe` scope; the OpenClaw plugin ID remains `home-assistant-safe`.
- The source/build workflow is authoritative: `plugin:build` regenerates OpenClaw metadata, while CI checks generated metadata and committed `dist/` without rewriting it.
- Production path deployments explicitly require `npm ci --omit=dev --ignore-scripts` even though committed `dist/` removes the need for build tooling.

### Compatibility

- Existing tool names and configuration keys are unchanged.
- Direct entity IDs must now use canonical lowercase `domain.object_id` form. Inputs that Home Assistant would normalize, including uppercase, surrounding whitespace, comma-separated lists, and IDs with extra dots, are rejected.
- REST responses larger than 16 MiB are rejected to keep memory use bounded.

[0.2.0]: https://github.com/rrockru/openclaw-home-assistant-safe/releases/tag/v0.2.0
