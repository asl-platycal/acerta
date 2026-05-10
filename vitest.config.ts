import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@acerta/core": path.resolve(__dirname, "core"),
      "@acerta/shared": path.resolve(__dirname, "shared"),
      "@acerta/services": path.resolve(__dirname, "services"),
    },
  },
  test: {
    include: ["**/*.test.ts"],
  },
});
