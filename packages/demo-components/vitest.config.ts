import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["**/*.spec.ts"],
    exclude: ["**/node_modules/**", "**/lib/**", "**/*.test.ts"],
  },
});
