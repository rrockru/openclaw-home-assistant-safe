import { describe, expect, it } from "vitest";
import { canRead, canWrite, createEntityAccessPolicy, patternMatches } from "../src/security.js";

const config = {
  readableEntities: ["sensor.*", "light.kitchen_*"],
  writableEntities: ["light.kitchen_*"],
  blockedEntities: ["sensor.secret_*", "light.kitchen_lock"],
};

describe("ACL matching", () => {
  it("supports exact and one-wildcard patterns", () => {
    expect(patternMatches("sensor.*", "sensor.room_temperature")).toBe(true);
    expect(patternMatches("light.*_lamp", "light.desk_lamp")).toBe(true);
    expect(patternMatches("light.*_lamp", "switch.desk_lamp")).toBe(false);
  });

  it("lets block rules override allow rules", () => {
    expect(canRead(config, "sensor.room_temperature")).toBe(true);
    expect(canRead(config, "sensor.secret_token")).toBe(false);
    expect(canWrite(config, "light.kitchen_ceiling")).toBe(true);
    expect(canWrite(config, "light.kitchen_lock")).toBe(false);
  });

  it("compiles one reusable policy without weakening block precedence", () => {
    const policy = createEntityAccessPolicy(config);
    expect(policy.canRead("sensor.room_temperature")).toBe(true);
    expect(policy.canRead("sensor.secret_token")).toBe(false);
    expect(policy.canWrite("light.kitchen_ceiling")).toBe(true);
    expect(policy.canWrite("light.kitchen_lock")).toBe(false);
  });
});
