import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    projects: [
      {
        plugins: [react(), tsconfigPaths()],
        test: {
          include: ["tests/**/*.unit.{test,spec}.{ts,tsx}"],
          name: "unit",
          environment: "node",
        },
      },
      {
        plugins: [react(), tsconfigPaths()],
        test: {
          include: ["tests/**/*.browser.{test,spec}.{ts,tsx}"],
          name: "browser",
          browser: {
            headless: true,
            enabled: true,
            provider: "playwright",
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
