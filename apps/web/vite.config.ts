import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: rootDir,
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "src"),
      "@acerta/core": path.resolve(rootDir, "../../core"),
      "@acerta/shared": path.resolve(rootDir, "../../shared"),
      "@acerta/services": path.resolve(rootDir, "../../services"),
      "@acerta/backend": path.resolve(rootDir, "../../backend"),
      "@acerta/tests": path.resolve(rootDir, "../../tests"),
    },
  },
});
