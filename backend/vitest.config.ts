import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    exclude: process.env.ZNUNY_IT === "1" ? [] : ["test/integration/**", "node_modules/**"],
  },
});
