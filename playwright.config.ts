import { defineConfig, devices } from "@playwright/test";

const projectRoot = process.env.CC_MUSIC_PROJECT_ROOT ?? ".tmp/cc-music-e2e";

export default defineConfig({
  testDir: "./src/tests/e2e",
  fullyParallel: true,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure"
  },
  webServer: [
    {
      command: "pnpm --filter @cc-music/local-bridge start",
      env: {
        CC_MUSIC_AGENT_ADAPTER: "mock",
        CC_MUSIC_PROJECT_ROOT: projectRoot,
        CC_MUSIC_TEST_MODE: "mocked",
        CC_MUSIC_WORKERS: "mock",
        PORT: "8787"
      },
      port: 8787,
      reuseExistingServer: !process.env.CI
    },
    {
      command: "pnpm dev:web",
      env: {
        CC_MUSIC_TEST_MODE: "mocked",
        VITE_CC_MUSIC_BRIDGE_URL: "http://127.0.0.1:8787"
      },
      port: 5173,
      reuseExistingServer: !process.env.CI
    }
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
