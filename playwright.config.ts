import { defineConfig } from "@playwright/test"
export default defineConfig({
  testDir: "./tests/ui",
  globalTeardown: "./tests/ui/teardown.ts",
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:4178", headless: true },
  webServer: {
    command: "npm start -- --port 4178 --audit .runtime/ui-tests.jsonl",
    url: "http://127.0.0.1:4178",
    reuseExistingServer: false,
  },
  reporter: [["list"], ["json", { outputFile: "test-results/ui.json" }]],
})
