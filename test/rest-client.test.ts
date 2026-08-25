import { beforeEach, describe, expect, it, vi } from "vitest";

const { loadToken } = vi.hoisted(() => ({ loadToken: vi.fn() }));
vi.mock("../src/security.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/security.js")>()),
  loadToken,
}));

import { haRequest, listStates, readState } from "../src/home-assistant/rest-client.js";

const config = {
  url: "http://home-assistant.local:8123",
  tokenFile: "/run/secrets/home-assistant-token",
  requestTimeoutMs: 1_000,
};

describe("Home Assistant REST client", () => {
  beforeEach(() => {
    loadToken.mockReset().mockResolvedValue("secret-token");
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("sets the configured credential after caller headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("null"));
    vi.stubGlobal("fetch", fetchMock);

    await haRequest(config, "/api/test", { headers: { Authorization: "Bearer attacker" } });

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer secret-token");
  });

  it("reports non-success responses with bounded details", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("x".repeat(3_000), { status: 500 })));
    const error = await haRequest(config, "/api/test").catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("Home Assistant API 500");
    expect((error as Error).message.length).toBeLessThan(2_100);
  });

  it("wraps network failures without exposing transport internals", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("socket detail")));
    await expect(haRequest(config, "/api/test")).rejects.toThrow("Home Assistant API request failed");
  });

  it("returns a clean timeout error and aborts fetch", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
          }),
      ),
    );

    const request = haRequest({ ...config, requestTimeoutMs: 1_000 }, "/api/test");
    const expectation = expect(request).rejects.toThrow("Home Assistant request timed out");
    await vi.advanceTimersByTimeAsync(1_000);
    await expectation;
  });

  it("rejects malformed state payloads", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ entity_id: 4, state: "on" }))));
    await expect(readState(config, "light.test")).rejects.toThrow("missing string entity_id");

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ not: "an array" }))));
    await expect(listStates(config)).rejects.toThrow("invalid states list");
  });

  it("rejects responses larger than the declared limit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { headers: { "content-length": String(17 * 1024 * 1024) } })),
    );
    await expect(haRequest(config, "/api/test")).rejects.toThrow("exceeded the 16 MiB limit");
  });
});
