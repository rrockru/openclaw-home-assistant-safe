import { beforeEach, describe, expect, it, vi } from "vitest";

const { haRequest, readState } = vi.hoisted(() => ({
  haRequest: vi.fn(),
  readState: vi.fn(),
}));

vi.mock("../src/home-assistant/rest-client.js", () => ({ haRequest, readState }));

import { callPowerService, getState } from "../src/home-assistant/state.js";

const config = {
  readableEntities: ["sensor.*", "light.allowed"],
  writableEntities: ["light.*"],
  blockedEntities: ["light.blocked"],
};

describe("state authorization", () => {
  beforeEach(() => {
    haRequest.mockReset().mockResolvedValue(null);
    readState.mockReset().mockResolvedValue({ entity_id: "sensor.temperature", state: "20" });
  });

  it("rejects denied reads before contacting Home Assistant", async () => {
    await expect(getState(config, "lock.front_door")).rejects.toThrow("Read access denied");
    expect(readState).not.toHaveBeenCalled();
  });

  it.each(["light.allowed,light.blocked", "light.blocked ", "LIGHT.blocked", "light.one.two"])(
    "rejects non-canonical write target %s before authorization",
    async (entityId) => {
      await expect(callPowerService(config, entityId, "turn_on")).rejects.toThrow("Invalid Home Assistant entity_id");
      expect(haRequest).not.toHaveBeenCalled();
    },
  );

  it.each(["turn_on", "turn_off"] as const)("enforces blocked rules for %s", async (service) => {
    await expect(callPowerService(config, "light.blocked", service)).rejects.toThrow("Write access denied");
    expect(haRequest).not.toHaveBeenCalled();
  });

  it.each(["turn_on", "turn_off"] as const)("calls only the authorized power service for %s", async (service) => {
    await expect(callPowerService(config, "light.allowed", service)).resolves.toMatchObject({
      ok: true,
      entity_id: "light.allowed",
      service,
    });
    expect(haRequest).toHaveBeenCalledWith(
      config,
      `/api/services/light/${service}`,
      { method: "POST", body: JSON.stringify({ entity_id: "light.allowed" }) },
      undefined,
    );
  });
});
