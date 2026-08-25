import { describe, expect, it, vi } from "vitest";

const { loadToken } = vi.hoisted(() => ({ loadToken: vi.fn() }));

vi.mock("../src/security.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/security.js")>()),
  loadToken,
}));

import { haWebSocketCommands } from "../src/home-assistant/websocket-client.js";

describe("Home Assistant WebSocket abort handling", () => {
  it("rechecks cancellation after asynchronous token loading", async () => {
    let resolveToken!: (token: string) => void;
    loadToken.mockReturnValueOnce(new Promise<string>((resolve) => {
      resolveToken = resolve;
    }));

    const webSocketConstructor = vi.fn();
    vi.stubGlobal("WebSocket", webSocketConstructor);
    const controller = new AbortController();
    const result = haWebSocketCommands<[]>(
      { url: "http://home-assistant.local:8123", tokenFile: "/run/secrets/token" },
      [],
      controller.signal,
    );

    controller.abort(new Error("cancelled while loading token"));
    resolveToken("test-token");

    await expect(result).rejects.toThrow("cancelled while loading token");
    expect(webSocketConstructor).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
