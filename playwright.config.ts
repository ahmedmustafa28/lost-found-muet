import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Test account credentials (see .env.test.example). The file is never
// committed; without it the tests skip with a message.
if (existsSync(".env.test.local")) process.loadEnvFile(".env.test.local");

// DEVELOPMENT.md 16.3. The tests share three signed-in users and build on
// each other's steps, so they run one at a time.
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // The dev server compiles each page on its first visit, which can be slow.
  timeout: 120_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL: "http://localhost:3000",
    navigationTimeout: 60_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
