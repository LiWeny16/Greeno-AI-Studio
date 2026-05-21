import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PassThrough } from "node:stream";
import { EventEmitter } from "node:events";

// ---------------------------------------------------------------------------
// Mock execa
// ---------------------------------------------------------------------------

const mockProcDefaults = {
  stdin: new PassThrough(),
  stdout: new PassThrough(),
  stderr: new PassThrough(),
  kill: vi.fn(),
  pid: 99999,
};

let mockProc: ReturnType<typeof createMockProc>;

function createMockProc() {
  const ee = new EventEmitter();
  const proc = Object.assign(ee, {
    stdin: new PassThrough(),
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    kill: vi.fn((_signal?: string) => {
      proc.exitCode = 1;
      ee.emit("exit", 1, null);
    }),
    pid: 99999,
    exitCode: null as number | null,
    on: ee.on.bind(ee),
    emit: ee.emit.bind(ee),
  });
  return proc;
}

vi.mock("execa", () => ({
  execa: vi.fn(() => mockProc),
}));

// ---------------------------------------------------------------------------
// Imports (after mock)
// ---------------------------------------------------------------------------

import { spawnPythonEngine } from "./worker-manager";
import type { BridgeConfig } from "./config";
import type { WorkerStreamEvent, PythonWorker } from "./worker-manager";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Standard test config with pythonWorker enabled
function makeConfig(overrides?: Partial<BridgeConfig["pythonWorker"]>): BridgeConfig {
  return {
    agentAdapter: "mock",
    host: "127.0.0.1",
    port: 8787,
    projectRoot: ".tmp/cc-music-worker-test",
    testMode: true,
    workers: "mock",
    pythonWorker: {
      enabled: true,
      pythonPath: "/fake/python/root",
      requestTimeoutMs: 500, // short for testing
      ...overrides,
    },
  };
}

/** Write a JSON line to the mock subprocess stdout (simulating Python output). */
function writeFromPython(line: Record<string, unknown>): void {
  mockProc.stdout.write(JSON.stringify(line) + "\n");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("spawnPythonEngine", () => {
  let worker: PythonWorker;
  let config: BridgeConfig;

  beforeEach(() => {
    mockProc = createMockProc();
    config = makeConfig();
  });

  afterEach(() => {
    // Clean up any lingering worker
    if (worker && worker.running) {
      worker.kill();
    }
  });

  // -- Spawn ---------------------------------------------------------------

  it("lazily spawns the Python subprocess on first request", () => {
    worker = spawnPythonEngine(config);
    // Before any request, execa should not have been called
    // (We skip the import check because mock module is already loaded)
    expect(worker.running).toBe(false);
  });

  it("sets running = true after first request triggers spawn", async () => {
    worker = spawnPythonEngine(config);

    // Initiate a request, then immediately respond
    const reqPromise = worker.request("ping");
    expect(worker.running).toBe(true);

    // Simulate response from Python
    writeFromPython({ type: "result", id: "req_001", data: "pong" });

    const result = await reqPromise;
    expect(result).toBe("pong");
    expect(worker.running).toBe(true);
  });

  // -- Request / Response --------------------------------------------------

  it('sends {"method":"ping"} and resolves with {"data":"pong"}', async () => {
    worker = spawnPythonEngine(config);

    const reqPromise = worker.request("ping");

    // Read what was written to stdin
    const stdinData = mockProc.stdin.read()?.toString() ?? "";
    expect(stdinData).toContain('"method":"ping"');
    expect(stdinData).toContain('"id":"req_001"');

    // Respond
    writeFromPython({ type: "result", id: "req_001", data: "pong" });

    const result = await reqPromise;
    expect(result).toBe("pong");
  });

  it("generates monotonically increasing request IDs", async () => {
    worker = spawnPythonEngine(config);

    const p1 = worker.request("a");
    const p2 = worker.request("b");

    const lines: string[] = [];
    // Collect what's been written to stdin
    let chunk: Buffer | null;
    while ((chunk = mockProc.stdin.read()) !== null) {
      lines.push(chunk.toString());
    }

    expect(lines.length).toBeGreaterThanOrEqual(2);
    // First request should have req_001
    expect(lines.join("")).toContain("req_001");
    expect(lines.join("")).toContain("req_002");

    // Respond to both (order doesn't matter because matching is by id)
    writeFromPython({ type: "result", id: "req_001", data: "a-ok" });
    writeFromPython({ type: "result", id: "req_002", data: "b-ok" });

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBe("a-ok");
    expect(r2).toBe("b-ok");
  });

  it("matches responses by id (out-of-order replies)", async () => {
    worker = spawnPythonEngine(config);

    const p1 = worker.request("fast");
    const p2 = worker.request("slow");

    // Respond to slow first, then fast
    writeFromPython({ type: "result", id: "req_002", data: "slow-done" });
    writeFromPython({ type: "result", id: "req_001", data: "fast-done" });

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBe("fast-done");
    expect(r2).toBe("slow-done");
  });

  // -- Timeout -------------------------------------------------------------

  it("rejects request after timeout", async () => {
    config = makeConfig({ requestTimeoutMs: 50 });
    worker = spawnPythonEngine(config);

    await expect(worker.request("slow_op")).rejects.toThrow(
      /timed out after 50ms/,
    );
  });

  it("cleans up pending request after timeout", async () => {
    config = makeConfig({ requestTimeoutMs: 50 });
    worker = spawnPythonEngine(config);

    await expect(worker.request("slow_op")).rejects.toThrow(/timed out/);

    // Next request should work fine
    const reqPromise = worker.request("ping");
    writeFromPython({ type: "result", id: "req_002", data: "pong" });
    await expect(reqPromise).resolves.toBe("pong");
  });

  // -- Error responses -----------------------------------------------------

  it("rejects when Python returns type:error", async () => {
    worker = spawnPythonEngine(config);

    const reqPromise = worker.request("bad_op");

    writeFromPython({
      type: "error",
      id: "req_001",
      error: { code: "invalid_input", message: "Bad params" },
    });

    await expect(reqPromise).rejects.toThrow("Bad params");
  });

  it("rejects with default message when error has no message", async () => {
    worker = spawnPythonEngine(config);

    const reqPromise = worker.request("bad_op");

    writeFromPython({ type: "error", id: "req_001", error: {} });

    await expect(reqPromise).rejects.toThrow("Python worker error");
  });

  // -- Stream events -------------------------------------------------------

  it("forwards stream_event lines to onEvent callbacks", async () => {
    worker = spawnPythonEngine(config);

    const events: WorkerStreamEvent[] = [];
    worker.onEvent((evt) => events.push(evt));

    // Send a request that also produces stream events
    const reqPromise = worker.request("generate");

    writeFromPython({
      type: "stream_event",
      data: { text: "Thinking...", step: 1 },
    });
    writeFromPython({
      type: "stream_event",
      data: { text: "Generating...", step: 2 },
    });
    writeFromPython({ type: "result", id: "req_001", data: "done" });

    await reqPromise;

    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({
      type: "stream_event",
      data: { text: "Thinking...", step: 1 },
    });
    expect(events[1]).toEqual({
      type: "stream_event",
      data: { text: "Generating...", step: 2 },
    });
  });

  it("isolates callback errors (one bad callback does not break others)", async () => {
    worker = spawnPythonEngine(config);

    const goodCalls: WorkerStreamEvent[] = [];
    worker.onEvent(() => {
      throw new Error("callback explosion");
    });
    worker.onEvent((evt) => goodCalls.push(evt));

    const reqPromise = worker.request("generate");
    writeFromPython({
      type: "stream_event",
      data: { msg: "hello" },
    });
    writeFromPython({ type: "result", id: "req_001", data: "ok" });

    await reqPromise;
    expect(goodCalls).toHaveLength(1);
    expect(goodCalls[0]).toEqual({
      type: "stream_event",
      data: { msg: "hello" },
    });
  });

  // -- Subprocess crash ----------------------------------------------------

  it("rejects all pending requests when subprocess exits with non-zero code", async () => {
    worker = spawnPythonEngine(config);

    const p1 = worker.request("op1");
    const p2 = worker.request("op2");

    // Simulate subprocess crash
    mockProc.exitCode = 1;
    mockProc.emit("exit", 1, null);

    await expect(p1).rejects.toThrow(/exited with code 1/);
    await expect(p2).rejects.toThrow(/exited with code 1/);
  });

  it("sets running = false after subprocess crash", async () => {
    worker = spawnPythonEngine(config);

    worker.request("op").catch(() => {});

    // Wait for spawn
    await new Promise((r) => setTimeout(r, 10));
    expect(worker.running).toBe(true);

    mockProc.exitCode = 1;
    mockProc.emit("exit", 1, null);

    expect(worker.running).toBe(false);
  });

  it("rejects pending requests when subprocess is killed by signal", async () => {
    worker = spawnPythonEngine(config);

    const p1 = worker.request("op1");

    mockProc.emit("exit", null, "SIGTERM");

    await expect(p1).rejects.toThrow(/killed by signal/);
  });

  // -- Invalid JSON --------------------------------------------------------

  it("skips invalid JSON lines on stdout without crashing", async () => {
    worker = spawnPythonEngine(config);

    const reqPromise = worker.request("ping");

    // Write garbage, then valid response
    writeFromPython({ type: "not-even-json", oops: true } as unknown as Record<string, unknown>);
    mockProc.stdout.write("this is not json at all\n");
    writeFromPython({ type: "result", id: "req_001", data: "pong" });

    const result = await reqPromise;
    expect(result).toBe("pong");
    // Invalid lines are just skipped
  });

  // -- Kill ----------------------------------------------------------------

  it("kill sends SIGTERM then SIGKILL after 5s", async () => {
    vi.useFakeTimers();
    worker = spawnPythonEngine(config);

    // Trigger spawn
    worker.request("ping").catch(() => {});
    expect(worker.running).toBe(true);

    const killSpy = vi.spyOn(mockProc, "kill");

    worker.kill();

    // First call: SIGTERM
    expect(killSpy).toHaveBeenCalledWith("SIGTERM");

    // After 5s: SIGKILL
    await vi.advanceTimersByTimeAsync(5_000);
    expect(killSpy).toHaveBeenCalledWith("SIGKILL");

    vi.useRealTimers();
  });

  // -- Stderr forwarding ---------------------------------------------------

  it("forwards subprocess stderr lines to logger", async () => {
    const logLines: string[] = [];
    const testLogger = {
      warn: (_obj: Record<string, unknown>, msg?: string) => {
        logLines.push(msg ?? "");
      },
      error: vi.fn(),
      info: vi.fn(),
    };

    worker = spawnPythonEngine(config, testLogger);
    worker.request("ping").catch(() => {});

    // Wait for spawn, then write to stderr
    await new Promise((r) => setTimeout(r, 10));
    mockProc.stderr.write("WARNING: something happened\n");

    // Need to wait for readline to process
    await new Promise((r) => setTimeout(r, 20));

    expect(logLines.some((l) => l.includes("something happened"))).toBe(true);
  });

  // -- Config: disabled worker ---------------------------------------------

  it("does not crash when pythonWorker is disabled (lazy spawn)", () => {
    const disabledConfig = makeConfig({ enabled: false });
    worker = spawnPythonEngine(disabledConfig);
    expect(worker.running).toBe(false);
    // Request would still attempt to spawn (enabled is advisory)
  });
});
