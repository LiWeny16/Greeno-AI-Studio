import { execa } from "execa";
import { createInterface } from "node:readline";
import type { BridgeConfig } from "./config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkerStreamEvent {
  type: string;
  data: Record<string, unknown>;
}

export interface PythonWorker {
  /** Send a JSON-RPC request. Returns a promise that resolves with the result. */
  request(method: string, params?: Record<string, unknown>): Promise<unknown>;

  /** Subscribe to stream events (messages, progress) from the Python worker. */
  onEvent(callback: (event: WorkerStreamEvent) => void): void;

  /** Kill the subprocess (SIGTERM, then SIGKILL after 5s). */
  kill(): void;

  /** Whether the process is currently running. */
  readonly running: boolean;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/** Minimal logger interface. Defaults to console. */
interface WorkerLogger {
  warn(obj: Record<string, unknown>, msg?: string): void;
  error(obj: Record<string, unknown>, msg?: string): void;
  info(obj: Record<string, unknown>, msg?: string): void;
}

// ---------------------------------------------------------------------------
// Spawn
// ---------------------------------------------------------------------------

export function spawnPythonEngine(
  config: BridgeConfig,
  logger?: WorkerLogger,
): PythonWorker {
  const log: WorkerLogger = logger ?? {
    warn: (obj, msg) => {
      const text = msg ?? String(obj);
      console.warn(`[worker-manager] ${text}`);
    },
    error: (obj, msg) => {
      const text = msg ?? String(obj);
      console.error(`[worker-manager] ${text}`);
    },
    info: (obj, msg) => {
      const text = msg ?? String(obj);
      console.info(`[worker-manager] ${text}`);
    },
  };

  // -- State ----------------------------------------------------------------
  const pending = new Map<string, PendingRequest>();
  const eventCallbacks: Array<(event: WorkerStreamEvent) => void> = [];
  let requestCounter = 0;
  let _running = false;
  let _subprocess: ReturnType<typeof execa> | null = null;
  let _rl: ReturnType<typeof createInterface> | null = null;
  let _stderrRl: ReturnType<typeof createInterface> | null = null;
  const requestTimeoutMs = config.pythonWorker?.requestTimeoutMs ?? 30_000;

  // -- Line handler ---------------------------------------------------------

  function handleLine(line: string): void {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(line) as Record<string, unknown>;
    } catch {
      log.warn({ line: line.slice(0, 200) }, "Invalid JSON on Python stdout");
      return;
    }

    const type = parsed["type"] as string | undefined;
    const id = parsed["id"] as string | undefined;

    if (type === "result" && typeof id === "string") {
      const req = pending.get(id);
      if (req) {
        clearTimeout(req.timer);
        pending.delete(id);
        req.resolve(parsed["data"]);
      }
    } else if (type === "error" && typeof id === "string") {
      const req = pending.get(id);
      if (req) {
        clearTimeout(req.timer);
        pending.delete(id);
        const errData = parsed["error"] as Record<string, unknown> | undefined;
        const message =
          typeof errData?.["message"] === "string"
            ? errData["message"]
            : "Python worker error";
        req.reject(new Error(message));
      } else {
        log.warn({ id, error: parsed["error"] }, "Unmatched error from Python");
      }
    } else if (type === "stream_event") {
      const event: WorkerStreamEvent = {
        type: "stream_event",
        data: (parsed["data"] as Record<string, unknown>) ?? {},
      };
      for (const cb of eventCallbacks) {
        try {
          cb(event);
        } catch {
          // callback errors must not break the pipeline
        }
      }
    }
  }

  // -- Reject all pending requests ------------------------------------------

  function rejectAllPending(reason: string): void {
    const err = new Error(reason);
    for (const [, req] of pending) {
      clearTimeout(req.timer);
      req.reject(err);
    }
    pending.clear();
  }

  // -- Start subprocess -----------------------------------------------------

  function ensureProcess(): ReturnType<typeof execa> {
    if (_subprocess && _running) return _subprocess;

    const pythonPath =
      config.pythonWorker?.pythonPath ?? process.cwd();

    // Build environment: inherit process.env, then overlay bridge config
    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) {
      if (v !== undefined) env[k] = v;
    }
    env["CC_MUSIC_PROJECT_ROOT"] = config.projectRoot;
    env["CC_MUSIC_AGENT_ADAPTER"] = config.agentAdapter;
    env["CC_MUSIC_WORKERS"] = config.workers;
    if (config.testMode) {
      env["CC_MUSIC_TEST_MODE"] = "mocked";
    }

    _subprocess = execa("uv", ["run", "python", "-m", "cc_music.server"], {
      cwd: pythonPath,
      env,
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      buffer: false,
      // execa v9 default cleanup handles process tree on exit
    });

    _running = true;

    // stdout line reader
    _rl = createInterface({ input: _subprocess.stdout! });
    _rl.on("line", (line: string) => {
      handleLine(line);
    });

    // stderr -> logger
    _stderrRl = createInterface({ input: _subprocess.stderr! });
    _stderrRl.on("line", (line: string) => {
      log.warn({ source: "python-stderr" }, line);
    });

    // Handle process exit
    _subprocess.on("exit", (code, signal) => {
      _running = false;
      _rl?.close();
      _stderrRl?.close();

      if (code !== 0 && signal === null) {
        const errMsg = `Python worker exited with code ${code ?? "null"}`;
        rejectAllPending(errMsg);
        log.error({ exitCode: code }, errMsg);
      }

      if (signal !== null) {
        const errMsg = `Python worker killed by signal ${signal}`;
        rejectAllPending(errMsg);
      }
    });

    return _subprocess;
  }

  // -- Public API -----------------------------------------------------------

  const worker: PythonWorker = {
    request(
      method: string,
      params: Record<string, unknown> = {},
    ): Promise<unknown> {
      return new Promise((resolve, reject) => {
        const counter = String(++requestCounter).padStart(3, "0");
        const id = `req_${counter}`;

        const timer = setTimeout(() => {
          pending.delete(id);
          reject(
            new Error(`Request ${id} timed out after ${requestTimeoutMs}ms`),
          );
        }, requestTimeoutMs);

        pending.set(id, { resolve, reject, timer });

        const proc = ensureProcess();
        const message = JSON.stringify({ id, method, params }) + "\n";
        proc.stdin!.write(message);
      });
    },

    onEvent(callback: (event: WorkerStreamEvent) => void): void {
      eventCallbacks.push(callback);
    },

    kill(): void {
      if (_subprocess && _running) {
        _subprocess.kill("SIGTERM");

        const forceTimer = setTimeout(() => {
          if (_subprocess && _running) {
            _subprocess.kill("SIGKILL");
          }
        }, 5_000);

        _subprocess.on("exit", () => {
          clearTimeout(forceTimer);
        });
      }
    },

    get running(): boolean {
      return _running;
    },
  };

  return worker;
}
