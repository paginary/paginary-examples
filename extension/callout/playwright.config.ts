import { defineConfig } from "@playwright/test";
import { TEST_PORT } from "./test/browser/vite.config.ts";

const baseURL = `http://localhost:${TEST_PORT}`;

export default defineConfig({
  testDir: "test/browser",
  testMatch: "*.spec.ts",
  use: { baseURL },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: "npx vite --config test/browser/vite.config.ts",
    url: baseURL,
    reuseExistingServer: false,
  },
});
