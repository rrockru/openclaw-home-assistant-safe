import { chmod, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadToken } from "../src/security.js";

let testDir: string;

describe("token file loading", () => {
  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), "home-assistant-safe-token-"));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it("reads a private regular file", async () => {
    const path = join(testDir, "token");
    await writeFile(path, " secret-token\n", { mode: 0o600 });
    await chmod(path, 0o600);
    await expect(loadToken(path)).resolves.toBe("secret-token");
  });

  it("rejects broad permissions", async () => {
    const path = join(testDir, "token");
    await writeFile(path, "secret-token", { mode: 0o644 });
    await chmod(path, 0o644);
    await expect(loadToken(path)).rejects.toThrow("permissions are too broad");
  });

  it("rejects symbolic links", async () => {
    const target = join(testDir, "target");
    const link = join(testDir, "token");
    await writeFile(target, "secret-token", { mode: 0o600 });
    await symlink(target, link);
    await expect(loadToken(link)).rejects.toThrow("regular non-symlink file");
  });
});
