# Security policy

## Threat model

This plugin runs in-process with OpenClaw and connects outbound to one operator-configured Home Assistant instance. Tool arguments and Home Assistant-provided names, states, attributes, registry entries, and error messages are treated as untrusted input. The OpenClaw operator, plugin configuration, OpenClaw host process, and configured Home Assistant account are trusted administrative boundaries.

The plugin limits what an agent can read or change. It is not a sandbox for malicious code already running as the OpenClaw service account, and it cannot make a broadly privileged Home Assistant token least-privileged by itself.

## Credentials

- Use a dedicated non-admin Home Assistant user and a revocable Long-Lived Access Token.
- Store only the token in a regular, non-symlink file with mode `0600` or stricter.
- Keep the token file's parent directory non-writable by untrusted users.
- Never place the token in plugin configuration, source control, prompts, logs, or command-line arguments.
- Prefer HTTPS/WSS whenever traffic crosses an untrusted network.
- Rotate the token after suspected disclosure and restart OpenClaw after replacing the token file.

The plugin opens, validates, and reads the same file descriptor to avoid pathname replacement between permission checks and reading. It never intentionally includes the token in tool results or application errors.

## ACL model

- `readableEntities` controls direct state reads and list output.
- `writableEntities` independently controls `turn_on` and `turn_off`.
- `blockedEntities` overrides both allowlists.
- Empty allowlists fail closed.
- Every direct target must be one canonical lowercase `domain.object_id`; lists, commas, whitespace, and alternate spellings are rejected before ACL evaluation.
- Entity listings apply the read ACL before state or registry metadata is returned to the model.

ACLs apply to the requested Home Assistant entity. A permitted scene, script, group, or other aggregate may have transitive effects configured inside Home Assistant. A permitted group, template, or helper may also expose related data in its own state or attributes. Avoid granting aggregate entities unless those effects and disclosures are intended.

## Write-operation risks

The only state-changing operations are `turn_on` and `turn_off`, and both require an explicit write-ACL match. Even these narrow actions can have physical consequences. Keep locks, alarms, covers, safety equipment, cameras, and high-impact scripts blocked unless there is a reviewed need.

Use OpenClaw's outer tool policy to hide write tools from agents that only need read access. Home Assistant permissions should independently prevent actions outside the plugin's intended scope.

## Supported versions

Security fixes are provided for the latest release. This repository is currently preparing version 0.2.0. OpenClaw 2026.5.17 or later and Node.js 24.15.0 or later are required.

## Reporting a vulnerability

Do not disclose suspected vulnerabilities in a public issue. Use the repository's **Security** tab and **Report a vulnerability** to submit a private GitHub security advisory. Include the affected version, configuration prerequisites, exact reproduction steps, impact, and any proposed mitigation. If private reporting is unavailable, open a public issue containing no sensitive details and ask the maintainer for a private contact channel.

The maintainer will acknowledge a complete report, validate its impact, coordinate a fix and release, and credit the reporter unless anonymity is requested.
