import path from "node:path";
import process from "node:process";

export type BridgeConfig = {
  agentAdapter: "mock" | "codex" | "claude";
  host: string;
  port: number;
  projectRoot: string;
  testMode: boolean;
  workers: "mock" | "local-light" | "local-python" | "local-heavy";
  pythonWorker: {
    /** Whether uv + Python 3.12+ is available. Default false — Python is optional in MVP. */
    enabled: boolean;
    /** Resolved path to the Python source root (directory containing pyproject.toml). */
    pythonPath: string;
    /** Per-request timeout in ms. Default 30 000. */
    requestTimeoutMs: number;
  };
};

export function readConfig(): BridgeConfig {
  return {
    agentAdapter: parseAgentAdapter(process.env.CC_MUSIC_AGENT_ADAPTER),
    host: process.env.HOST ?? "127.0.0.1",
    port: Number(process.env.PORT ?? "8787"),
    projectRoot: path.resolve(process.env.CC_MUSIC_PROJECT_ROOT ?? ".cc-music-projects"),
    testMode: process.env.CC_MUSIC_TEST_MODE === "mocked",
    workers: parseWorkers(process.env.CC_MUSIC_WORKERS),
    pythonWorker: {
      enabled: parsePythonWorkerEnabled(process.env.CC_MUSIC_PYTHON_ENABLED),
      pythonPath: path.resolve(process.env.CC_MUSIC_PYTHON_PATH ?? process.cwd()),
      requestTimeoutMs: Number(process.env.CC_MUSIC_PYTHON_TIMEOUT ?? "30000"),
    },
  };
}

function parseAgentAdapter(value: string | undefined): BridgeConfig["agentAdapter"] {
  if (value === "codex" || value === "claude") {
    return value;
  }
  return "mock";
}

function parseWorkers(value: string | undefined): BridgeConfig["workers"] {
  if (value === "local-light" || value === "local-python" || value === "local-heavy") {
    return value;
  }
  return "mock";
}

function parsePythonWorkerEnabled(value: string | undefined): boolean {
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  // In test mode, default to false unless explicitly enabled.
  // Python worker is optional in MVP; agents run via mock by default.
  return false;
}
