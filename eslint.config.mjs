import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 個人資料・ローカル検証用の一時スクリプトはアプリコードではない。
    ".private/**",
    // Claude Design のモック（docs/mockup/*.dc.html と同梱の support.js）は
    // 出典としてそのまま置いているだけなので Lint の対象にしない
    "docs/**",
  ]),
]);

export default eslintConfig;
