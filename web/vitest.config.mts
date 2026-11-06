import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: { alias: { "@": resolve(import.meta.dirname, "src") } },
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.mts"],
    // test dùng chung Postgres + khoá row của products: chạy song song sẽ deadlock
    fileParallelism: false,
    testTimeout: 20000,
  },
});
