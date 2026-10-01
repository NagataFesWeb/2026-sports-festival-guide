// CLIの接続先を既存設定から取得する。SQLや秘密鍵をコマンド文字列に埋め込まない。
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
process.chdir(root);
if (fs.existsSync(".env.local")) process.loadEnvFile(".env.local");
const mode = process.argv[2];
const input = process.argv.slice(3);
const sqlFile = (file) => {
  const absolute = path.resolve(root, file);
  if (!absolute.endsWith(".sql") || !fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    throw new Error("実在する.sqlファイルを指定してください");
  }
  return absolute;
};

try {
  let files;
  if (mode === "check" && input.length === 0) files = [sqlFile("supabase/casino-status.sql")];
  else if (mode === "sql" && input.length === 1) files = [sqlFile(input[0])];
  else if (mode === "apply-casino" && input.length === 0) {
    files = ["supabase/casino-atomic.sql", "supabase/casino-day-setup.sql", "supabase/casino-status.sql"].map(sqlFile);
  } else throw new Error("使い方: npm run db:check / npm run db:sql -- supabase/ファイル.sql / npm run db:apply-casino");

  const configuredUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  const projectRef = configuredUrl.hostname.match(/^([a-z]{20})\.supabase\.co$/)?.[1];
  if (!projectRef) throw new Error(".env.localのNEXT_PUBLIC_SUPABASE_URLにSupabaseプロジェクトのURLを設定してください");
  const require = createRequire(import.meta.url);
  const packagePath = require.resolve("supabase/package.json");
  const packageInfo = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  const cli = path.resolve(path.dirname(packagePath), packageInfo.bin.supabase);

  for (const file of files) {
    console.log(`Supabase ${projectRef}: ${path.basename(file)}`);
    const result = spawnSync(process.execPath, [cli, "db", "query", "--linked", "--project-ref", projectRef, "--file", file], {
      cwd: root, stdio: "inherit", windowsHide: true,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      console.error("SQL実行は完了していません。未認証なら npm run db:login でログインしてください。");
      process.exit(result.status ?? 1);
    }
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
