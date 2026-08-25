import { describe, expect, it } from "vitest";
import {
  canRead,
  canWrite,
  createEntityAccessPolicy,
  patternMatches,
  requireCanonicalEntityId,
} from "../src/security.js";

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

  it("requires one canonical entity id before ACL evaluation", () => {
    expect(requireCanonicalEntityId("light.kitchen_ceiling")).toBe("light.kitchen_ceiling");
    for (const invalid of [
      "light.allowed,light.blocked",
      "light.blocked ",
      " Light.blocked",
      "LIGHT.blocked",
      "light",
      "light.one.two",
      "light.",
    ]) {
      expect(() => requireCanonicalEntityId(invalid)).toThrow("Invalid Home Assistant entity_id");
    }
  });

  it("lets block rules override allow rules", () => {
    expect(canRead(config, "sensor.room_temperature")).toBe(true);
    expect(canRead(config, "sensor.secret_token")).toBe(false);
    expect(canWrite(config, "light.kitchen_ceiling")).toBe(true);
    expect(canWrite(config, "light.kitchen_lock")).toBe(false);
  });

  it("keeps read and write permissions independent", () => {
    expect(canRead(config, "sensor.room_temperature")).toBe(true);
    expect(canWrite(config, "sensor.room_temperature")).toBe(false);
    expect(canRead(config, "light.kitchen_ceiling")).toBe(true);
    expect(canWrite(config, "light.kitchen_ceiling")).toBe(true);
  });

  it("compiles one reusable policy without weakening block precedence", () => {
    const policy = createEntityAccessPolicy(config);
    expect(policy.canRead("sensor.room_temperature")).toBe(true);
    expect(policy.canRead("sensor.secret_token")).toBe(false);
    expect(policy.canWrite("light.kitchen_ceiling")).toBe(true);
    expect(policy.canWrite("light.kitchen_lock")).toBe(false);
  });
});
