// 元CSVを公開Gitへ追加せず、非公開Storageに保存する。旧版はハッシュ名で退避する。
import fs from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { storageConfig } from "./entries-source.mjs";

process.chdir(fileURLToPath(new URL("../", import.meta.url)));
if (fs.existsSync(".env.local")) process.loadEnvFile(".env.local");
const config = storageConfig(process.env);
if (!config) throw new Error("Supabase URLとサーバー専用キーを設定してください");
const file = "data/学籍番号別出場競技.csv";
if (!fs.existsSync(file)) throw new Error("アップロードするローカルCSVがありません");
// 本番と同じ検証を通してからアップロードする。
const checked = spawnSync(process.execPath, ["scripts/generate-entries.mjs"], { stdio: "inherit", windowsHide: true });
if (checked.status !== 0) process.exit(checked.status ?? 1);
const csv = fs.readFileSync(file);
if (csv.toString("utf8").trim().split(/\r?\n/).length < 2) throw new Error("空の出場表はアップロードしません");
const version = body => createHash("sha256").update(body).digest("hex");
const request = (route, options = {}) => fetch(`${config.url}/storage/v1/${route}`, {
  ...options, headers: { ...config.headers, ...options.headers }, signal: AbortSignal.timeout(30_000), redirect: "error",
});
let buckets = await request("bucket");
if (!buckets.ok) throw new Error(`Storage接続 HTTP ${buckets.status}`);
const bucket = (await buckets.json()).find(b => b.id === config.bucket);
if (bucket?.public) throw new Error("出場表用バケットが公開設定です。アップロードを停止します");
if (!bucket) {
  const made = await request("bucket", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: config.bucket, name: config.bucket, public: false, file_size_limit: 1_048_576, allowed_mime_types: ["text/csv"] }) });
  if (!made.ok) throw new Error(`非公開バケット作成 HTTP ${made.status}`);
}
const put = async (objectPath, body, overwrite) => {
  const saved = await request(`object/${objectPath}`, { method: "POST", headers: { "Content-Type": "text/csv", "x-upsert": String(overwrite) }, body });
  if (!saved.ok) throw new Error(`出場表保存 HTTP ${saved.status}`);
};
const old = await request(`object/authenticated/${config.objectPath}`);
if (old.ok) {
  const previous = Buffer.from(await old.arrayBuffer());
  if (version(previous) === version(csv)) { console.log("Storageの出場表は同じ版です。変更なし。"); process.exit(0); }
  await put(`${encodeURIComponent(config.bucket)}/entries/archive/${version(previous)}.csv`, previous, true);
} else {
  // 「存在しない」以外の障害では上書きしない。
  const error = await old.json().catch(() => ({}));
  if (old.status !== 404 && !(old.status === 400 && String(error.statusCode) === "404")) throw new Error(`旧出場表確認 HTTP ${old.status}`);
}
await put(config.objectPath, csv, true);
const verify = await request(`object/authenticated/${config.objectPath}`);
if (!verify.ok || version(Buffer.from(await verify.arrayBuffer())) !== version(csv)) throw new Error("保存後の出場表が元CSVと一致しません");
console.log(`非公開Storageへ出場表を保存し、SHA256一致を確認しました（版 ${version(csv).slice(0, 8)}）。`);
