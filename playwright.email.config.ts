import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "completion-email.spec.ts",
  outputDir: ".netlify/email-browser",
  workers: 1,
  timeout: 45000,
  use: { channel: "chrome", headless: true, trace: "retain-on-failure" },
  reporter: "list",
});
