import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { haWebSocketCommands } from "../src/home-assistant/websocket-client.js";

class FakeWebSocket extends EventTarget {
  static instances: FakeWebSocket[] = [];

  readonly sent: string[] = [];
  closed = false;

  constructor(readonly url: string) {
    super();
    FakeWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.closed = true;
  }

  message(message: unknown): void {
    this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(message) }));
  }
}

let testDir: string;
let tokenFile: string;

async function latestSocket(): Promise<FakeWebSocket> {
  await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
  return FakeWebSocket.instances[0]!;
}

describe("Home Assistant WebSocket client", () => {
  beforeEach(async () => {
    FakeWebSocket.instances = [];
    vi.stubGlobal("WebSocket", FakeWebSocket);
    testDir = await mkdtemp(join(tmpdir(), "home-assistant-safe-test-"));
    tokenFile = join(testDir, "token");
    await writeFile(tokenFile, "test-token\n", { mode: 0o600 });
    await chmod(tokenFile, 0o600);
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await rm(testDir, { recursive: true, force: true });
  });

  it("tracks an undefined command result as received", async () => {
    const resultPromise = haWebSocketCommands<[undefined]>(
      { url: "http://home-assistant.local:8123", tokenFile },
      [{ type: "test/command" }],
    );
    const socket = await latestSocket();

    socket.message({ type: "auth_required" });
    socket.message({ type: "auth_ok" });
    socket.message({ id: 1, type: "result", success: true, result: undefined });

    await expect(resultPromise).resolves.toEqual([undefined]);
    expect(socket.closed).toBe(true);
  });

  it("rejects immediately when the socket closes before authentication", async () => {
    const resultPromise = haWebSocketCommands<[]>(
      { url: "http://home-assistant.local:8123", tokenFile, requestTimeoutMs: 30_000 },
      [],
    );
    const socket = await latestSocket();

    socket.dispatchEvent(new Event("close"));

    await expect(resultPromise).rejects.toThrow("closed before authentication completed");
    expect(socket.closed).toBe(true);
  });

  it("owns command ids even if a caller supplies an id field", async () => {
    const resultPromise = haWebSocketCommands<[string]>(
      { url: "http://home-assistant.local:8123", tokenFile },
      [{ type: "test/command", id: 99 }],
    );
    const socket = await latestSocket();

    socket.message({ type: "auth_required" });
    socket.message({ type: "auth_ok" });

    expect(JSON.parse(socket.sent[1]!)).toMatchObject({ type: "test/command", id: 1 });
    socket.message({ id: 1, type: "result", success: true, result: "ok" });
    await expect(resultPromise).resolves.toEqual(["ok"]);
  });
});
