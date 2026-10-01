// 本番データに触れず、ローカルの使い捨てメモリDBでカジノAPIを通し確認する。
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const origin = new URL(process.argv[2] ?? "http://localhost:3100");
if (!["localhost", "127.0.0.1"].includes(origin.hostname)) throw new Error("ローカルのメモリDB専用です");
const userId = `check-${randomUUID().slice(0, 8)}`;
let cookie = "";
async function call(path, method = "GET", body, key, authenticated = true) {
  const res = await fetch(new URL(path, origin), {
    method, headers: { "Content-Type": "application/json", ...(authenticated ? { Cookie: cookie } : {}), ...(key ? { "Idempotency-Key": key } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30_000),
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  return { status: res.status, data: await res.json() };
}
assert.equal((await call("/api/casino/credit", "POST", { action: "borrow", amount: 100 }, undefined, false)).status, 401);
assert.equal((await call("/api/casino/enter", "POST", { userId: "2117", password: "wrong-password", mode: "login" })).status, 401);
assert.equal((await call("/api/casino/enter", "POST", { userId, password: "test-password", nickname: "動作確認", mode: "register" })).status, 200);
const path = "/api/casino/markets/race-05-g1";
assert.equal((await call(path)).data.view.account.pointsBalance, 1000);
const bet = { kind: "win", selection: ["t1"], amount: 100 };
const betKey = randomUUID();
const first = await call(`${path}/bets`, "POST", bet, betKey);
assert.equal(first.status, 200); assert.equal(first.data.view.account.pointsBalance, 900);
assert.equal((await call(`${path}/bets`, "POST", bet, betKey)).data.view.myBets.length, 1);
assert.equal((await call(`${path}/bets`, "POST", { ...bet, amount: 0 })).status, 422);
assert.equal((await call(`${path}/bets`, "POST", bet, "bad-key")).status, 400);
assert.equal((await call("/api/casino/markets/race-03-g3/bets", "POST", bet)).status, 409);
const betId = first.data.view.myBets[0].id;
const canceled = await call(`/api/casino/bets/${betId}`, "DELETE");
assert.equal(canceled.data.view.account.pointsBalance, 1000);
assert.equal((await call(`/api/casino/bets/${betId}`, "DELETE")).status, 404);
for (const kind of ["place", "trifecta"]) {
  const selection = kind === "trifecta" ? ["t1", "t2", "t3"] : ["t1"];
  const placed = await call(`${path}/bets`, "POST", { kind, selection, amount: 100 }, randomUUID());
  assert.equal(placed.status, 200);
  assert.equal(placed.data.view.market.trifectaOddsDefault, 336);
  assert.deepEqual(placed.data.view.market.trifectaOddsOverrides, {});
  assert.equal(placed.data.view.account.pointsBalance, 900);
  const [ticket] = placed.data.view.myBets;
  assert.equal(ticket.kind, kind);
  assert.deepEqual(ticket.selection, selection);
  const undone = await call(`/api/casino/bets/${ticket.id}`, "DELETE");
  assert.equal(undone.data.view.account.pointsBalance, 1000);
}
const creditKey = randomUUID();
const borrowed = await call("/api/casino/credit", "POST", { action: "borrow", amount: 500 }, creditKey);
assert.equal(borrowed.data.view.account.pointsBalance, 1500);
assert.equal((await call("/api/casino/credit", "POST", { action: "borrow", amount: 500 }, creditKey)).data.view.account.debtAmount, 500);
const repaid = await call("/api/casino/credit", "POST", { action: "repay", amount: 500 }, randomUUID());
assert.equal(repaid.data.view.account.pointsBalance, 1000); assert.equal(repaid.data.view.account.debtAmount, 0);
const times = await Promise.all(Array.from({ length: 30 }, async () => {
  const start = performance.now();
  assert.equal((await call(path)).status, 200);
  return performance.now() - start;
}));
times.sort((a, b) => a - b);
assert.equal((await call("/api/casino/logout", "POST")).status, 200);
assert.equal((await call(path)).status, 401);
console.log(`CASINO API PASS: 登録・認証・単勝・複勝・三連単最低336倍・取消・締切・借入れ・返済・再送・ログアウト。30同時取得 p95=${Math.round(times[28])}ms（ローカル）`);
