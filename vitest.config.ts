import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@acerta/core": path.resolve(__dirname, "core"),
      "@acerta/shared": path.resolve(__dirname, "shared"),
      "@acerta/services": path.resolve(__dirname, "services"),
      "@acerta/types": path.resolve(__dirname, "types"),
    },
  },
  test: {
    include: ["**/*.test.ts"],
  },
});
