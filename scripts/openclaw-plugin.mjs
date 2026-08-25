import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const commands = {
  metadata: ["plugins", "build", "--root", ".", "--entry", "./dist/index.js"],
  "metadata:check": ["plugins", "build", "--root", ".", "--entry", "./dist/index.js", "--check"],
  validate: ["plugins", "validate", "--root", ".", "--entry", "./dist/index.js"],
};

const mode = process.argv[2];
const args = commands[mode];
if (!args) {
  throw new Error(`Unknown OpenClaw plugin task: ${mode ?? "(missing)"}`);
}

const stateDir = await mkdtemp(join(tmpdir(), "home-assistant-safe-openclaw-"));
try {
  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn("openclaw", args, {
      env: { ...process.env, OPENCLAW_STATE_DIR: stateDir },
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) reject(new Error(`OpenClaw CLI terminated by ${signal}`));
      else resolve(code ?? 1);
    });
  });

  if (exitCode !== 0) process.exitCode = exitCode;
} finally {
  await rm(stateDir, { recursive: true, force: true });
}
