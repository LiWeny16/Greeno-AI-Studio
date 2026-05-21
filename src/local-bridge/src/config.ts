import path from "node:path";
import process from "node:process";

export type BridgeConfig = {
  agentAdapter: "mock" | "codex" | "claude";
  host: string;
  port: number;
  projectRoot: string;
  testMode: boolean;
  workers: "mock" | "local-light" | "local-python" | "local-heavy";
};

export function readConfig(): BridgeConfig {
  return {
    agentAdapter: parseAgentAdapter(process.env.CC_MUSIC_AGENT_ADAPTER),
    host: process.env.HOST ?? "127.0.0.1",
    port: Number(process.env.PORT ?? "8787"),
    projectRoot: path.resolve(process.env.CC_MUSIC_PROJECT_ROOT ?? ".cc-music-projects"),
    testMode: process.env.CC_MUSIC_TEST_MODE === "mocked",
    workers: parseWorkers(process.env.CC_MUSIC_WORKERS)
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
