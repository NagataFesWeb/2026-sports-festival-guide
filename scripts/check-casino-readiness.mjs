// 本番DBの準備確認。口座・ベット・結果は作成／変更しない。
import fs from "node:fs";
if (fs.existsSync(".env.local")) process.loadEnvFile(".env.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const secret = process.env.SESSION_SECRET;
if (!url || !key || !secret || secret.length < 16) throw new Error("Supabaseと16文字以上のSESSION_SECRETが必要です");
const headers = { apikey: key, ...(key.startsWith("sb_secret_") ? {} : { Authorization: `Bearer ${key}` }), "Content-Type": "application/json" };
async function request(path, options = {}) {
  const res = await fetch(`${url}/rest/v1/${path}`, { ...options, headers, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`${path.split("?")[0]} HTTP ${res.status}（DBのSQL適用と設定を確認してください）`);
  return res;
}
for (const table of ["casino_accounts", "bets", "casino_receipts", "markets", "settings"]) {
  try { await request(`${table}?select=*&limit=0`); console.log(`OK ${table}`); }
  catch(e) { console.error(e.message); process.exitCode=1; }
}
// 最終精算日時の期待値を故意に違えるため、RPCは何も保存しない。
try { await request("rpc/commit_casino_mutation", { method: "POST", body: JSON.stringify({ change: {
  expected_final_settled_at: "1970-01-01T00:00:00Z", expected_accounts: [], expected_markets: [],
  expected_events: [], expected_bets: [], accounts: [], payouts: [], all_accounts: false, all_markets: false,
} }) });
console.log("OK 原子的保存RPC（書き込みなし）"); } catch(e) { console.error(e.message); process.exitCode=1; }
const markets = await (await request("markets?select=id,type,event_id,status,deadline&limit=1000")).json();
const events = await (await request("events?select=id,delay_min&limit=1000")).json();
const settings = await (await request("settings?select=final_settled_at&id=eq.1")).json();
console.log(`Market ${markets.length}件／受付設定 ${markets.filter((m) => m.status === "open").length}件／最終精算 ${settings[0]?.final_settled_at ? "済" : "未実施"}`);
if (markets.length === 0) { console.error("要対応：管理画面で当日のMarketを作成してください"); process.exitCode = 1; }
if (settings.length !== 1) { console.error("要対応：settingsの初期行がありません。schema.sqlの初期設定を確認してください"); process.exitCode = 1; }
if (settings[0]?.final_settled_at) { console.error("要確認：最終精算済みのため新規口座・ベット・借入れは停止します"); process.exitCode = 1; }

const stale = markets.filter((m) => {
  const delay = m.type === "event" ? events.find((e) => e.id === m.event_id)?.delay_min ?? 0 : 0;
  return m.status === "open" && Date.parse(m.deadline) + delay * 60_000 <= Date.now();
}).length;
console.log(`締切超過の受付設定 ${stale}件`);
if (stale) { console.error("要確認：管理画面の締切日時を当日の日本時間で確認してください"); process.exitCode=1; }
