import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    restoreMocks: true,
    setupFiles: ["tests/setup/ui.ts"],
    include: ["tests/ui/**/*.test.tsx"]
  }
});
