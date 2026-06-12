import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    restoreMocks: true,
    fileParallelism: false,
    setupFiles: ["tests/setup/node.ts"],
    include: [
      "tests/unit/**/*.test.ts",
      "tests/api/**/*.test.ts",
      "tests/electron/**/*.test.ts"
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: [
        "server/app-state.ts",
        "server/asset-service.ts",
        "server/bank-schema.ts",
        "server/export-service.ts",
        "server/json-file.ts",
        "server/storage.ts",
        "server/latex.ts",
        "shared/validation.ts",
        "src/itemOrder.ts",
        "src/wheelScroll.ts"
      ],
      thresholds: {
        statements: 75,
        lines: 75,
        functions: 75,
        branches: 65
      }
    }
  }
});
