import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "test/browser",
  testMatch: "*.spec.ts",
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: "npx vite --config test/browser/vite.config.ts",
    url: "http://localhost:5179",
    reuseExistingServer: false,
  },
});
