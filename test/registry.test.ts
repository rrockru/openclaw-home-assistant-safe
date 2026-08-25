import { beforeEach, describe, expect, it, vi } from "vitest";

const { haWebSocketCommands } = vi.hoisted(() => ({
  haWebSocketCommands: vi.fn(),
}));

vi.mock("../src/home-assistant/websocket-client.js", () => ({ haWebSocketCommands }));

import { clearRegistryCache, getRegistrySnapshot } from "../src/home-assistant/registry.js";

const config = {
  url: "http://home-assistant.local:8123",
  tokenFile: "/run/secrets/home-assistant-token",
  registryCacheTtlMs: 1_000,
};

const rawSnapshot = [
  [{ entity_id: "sensor.temperature", device_id: "device-1", area_id: null }],
  [{ id: "device-1", area_id: "living_room", name: "Thermometer" }],
  [{ area_id: "living_room", name: "Living room" }],
] as const;

describe("registry cache", () => {
  beforeEach(() => {
    clearRegistryCache();
    haWebSocketCommands.mockReset();
    vi.useRealTimers();
  });

  it("coalesces concurrent misses without letting one caller abort the shared refresh", async () => {
    let resolveRefresh!: (value: typeof rawSnapshot) => void;
    const refresh = new Promise<typeof rawSnapshot>((resolve) => {
      resolveRefresh = resolve;
    });
    haWebSocketCommands.mockReturnValue(refresh);

    const controller = new AbortController();
    const abortedCall = getRegistrySnapshot(config, controller.signal);
    const sharedCall = getRegistrySnapshot(config);
    const abortedExpectation = expect(abortedCall).rejects.toThrow("caller stopped waiting");

    controller.abort(new Error("caller stopped waiting"));
    await abortedExpectation;
    resolveRefresh(rawSnapshot);

    const snapshot = await sharedCall;
    expect(snapshot.devices.get("device-1")?.area_id).toBe("living_room");
    expect(haWebSocketCommands).toHaveBeenCalledTimes(1);
    expect(haWebSocketCommands.mock.calls[0]?.[2]).toBeUndefined();

    await expect(getRegistrySnapshot(config)).resolves.toBe(snapshot);
    expect(haWebSocketCommands).toHaveBeenCalledTimes(1);
  });

  it("starts the TTL when a successful refresh completes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);

    let resolveRefresh!: (value: typeof rawSnapshot) => void;
    haWebSocketCommands.mockReturnValueOnce(
      new Promise<typeof rawSnapshot>((resolve) => {
        resolveRefresh = resolve;
      }),
    );

    const first = getRegistrySnapshot(config);
    vi.setSystemTime(10_000);
    resolveRefresh(rawSnapshot);
    const snapshot = await first;

    vi.setSystemTime(10_999);
    await expect(getRegistrySnapshot(config)).resolves.toBe(snapshot);
    expect(haWebSocketCommands).toHaveBeenCalledTimes(1);

    haWebSocketCommands.mockResolvedValueOnce(rawSnapshot);
    vi.setSystemTime(11_000);
    await getRegistrySnapshot(config);
    expect(haWebSocketCommands).toHaveBeenCalledTimes(2);
  });

  it("does not cache failed refreshes", async () => {
    haWebSocketCommands.mockRejectedValueOnce(new Error("registry unavailable")).mockResolvedValueOnce(rawSnapshot);

    await expect(getRegistrySnapshot(config)).rejects.toThrow("registry unavailable");
    await expect(getRegistrySnapshot(config)).resolves.toMatchObject({ entities: expect.any(Map) });
    expect(haWebSocketCommands).toHaveBeenCalledTimes(2);
  });

  it("applies each caller's TTL to the cached completion time", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    haWebSocketCommands.mockResolvedValue(rawSnapshot);

    await getRegistrySnapshot({ ...config, registryCacheTtlMs: 10_000 });
    vi.setSystemTime(1_600);
    await getRegistrySnapshot({ ...config, registryCacheTtlMs: 500 });

    expect(haWebSocketCommands).toHaveBeenCalledTimes(2);
  });

  it("rejects malformed registry responses without caching them", async () => {
    haWebSocketCommands.mockResolvedValueOnce([[{ entity_id: 4 }], [], []]).mockResolvedValueOnce(rawSnapshot);

    await expect(getRegistrySnapshot(config)).rejects.toThrow("missing string entity_id");
    await expect(getRegistrySnapshot(config)).resolves.toMatchObject({ entities: expect.any(Map) });
    expect(haWebSocketCommands).toHaveBeenCalledTimes(2);
  });

  it("does not retain snapshots when caching is disabled", async () => {
    haWebSocketCommands.mockResolvedValue(rawSnapshot);
    const uncachedConfig = { ...config, registryCacheTtlMs: 0 };

    await getRegistrySnapshot(uncachedConfig);
    await getRegistrySnapshot(uncachedConfig);

    expect(haWebSocketCommands).toHaveBeenCalledTimes(2);
  });

  it("bounds registry snapshots across configured instances", async () => {
    haWebSocketCommands.mockResolvedValue(rawSnapshot);

    for (let index = 0; index < 17; index += 1) {
      await getRegistrySnapshot({ ...config, tokenFile: `/run/secrets/token-${index}` });
    }
    await getRegistrySnapshot({ ...config, tokenFile: "/run/secrets/token-0" });

    expect(haWebSocketCommands).toHaveBeenCalledTimes(18);
  });
});
