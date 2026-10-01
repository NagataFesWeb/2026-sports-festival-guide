// Vitest の設定。tsconfig の "@/..." エイリアスをテスト実行時にも解決する
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "scripts/**/*.test.mjs"],
    env: {
      // テスト中はメモリ DB をファイルに書き出さない
      DB_PERSIST: "0",
    },
  },
});
