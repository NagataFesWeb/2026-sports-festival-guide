// store.ts（永続化つきのカジノ操作）のテスト。DB は MemoryRepository（シードは fixtures.ts）
import { beforeEach, describe, expect, it } from "vitest";
import { getRepository } from "../db";
import { resetMemoryState } from "../db/memory";
import {
  authenticateAccount,
  borrowPoints,
  getCreditView,
  getHistoryView,
  getMarketView,
  getRankView,
  INITIAL_POINTS,
  registerAccount,
  repayPoints,
  submitBet,
  withdrawBet,
} from "./store";

/** シードの仮ログインユーザー（残高 1240 / 借金 500・パスワードは学籍番号と同じ） */
const ME = "2117";
/** 受付中の Market（男女混合リレー 1年。締切は状態作成時刻の約 13 分後） */
const OPEN = "race-05-g1";
/** 締切済みの Market（女子6×100mリレー 3年） */
const CLOSED = "race-03-g3";
/** 結果確定済みの Market（男子スウェーデンリレー 1年） */
const SETTLED = "race-04-g1";
/** 名簿にあるが口座が無い学籍番号 */
const NO_ACCOUNT = "2101";

function now(): Date {
  return new Date();
}

beforeEach(() => {
  // 各テストはシードから始める（getRepository のインスタンスは使い回して良い）
  resetMemoryState();
});

describe("submitBet", () => {
  it("受付中の Market にベットすると残高が減り、ベットが記録される", async () => {
    const repository = getRepository();
    const before = await repository.getAccount(ME);
    const r = await submitBet(OPEN, ME, { kind: "win", selection: ["t1"], amount: 200 }, now());

    expect(r.ok).toBe(true);
    const after = await repository.getAccount(ME);
    expect(after?.pointsBalance).toBe((before?.pointsBalance ?? 0) - 200);
    expect(after?.debtAmount).toBe(before?.debtAmount);

    const mine = await repository.listBets({ marketId: OPEN, studentId: ME });
    expect(mine).toHaveLength(1);
    expect(mine[0].amount).toBe(200);
    expect(mine[0].selection).toEqual(["t1"]);
    expect(mine[0].payoutAmount).toBeNull();
  });

  it("残高を超えるベットは拒否され、残高もベットも変わらない", async () => {
    const repository = getRepository();
    const before = await repository.getAccount(ME);
    const r = await submitBet(OPEN, ME, { kind: "win", selection: ["t1"], amount: 99_999 }, now());

    expect(r).toEqual({ ok: false, error: "insufficient_balance" });
    const after = await repository.getAccount(ME);
    expect(after?.pointsBalance).toBe(before?.pointsBalance);
    expect(await repository.listBets({ marketId: OPEN, studentId: ME })).toHaveLength(0);
  });

  it("締切を過ぎた Market にはベットできない", async () => {
    const r = await submitBet(CLOSED, ME, { kind: "win", selection: ["t1"], amount: 100 }, now());
    expect(r).toEqual({ ok: false, error: "market_closed" });
  });

  it("存在しない Market は market_not_found", async () => {
    const r = await submitBet("no-such-market", ME, { kind: "win", selection: ["t1"], amount: 100 }, now());
    expect(r).toEqual({ ok: false, error: "market_not_found" });
  });

  it("口座が無い学籍番号は account_not_found（残高を押さえない）", async () => {
    const r = await submitBet(OPEN, NO_ACCOUNT, { kind: "win", selection: ["t1"], amount: 100 }, now());
    expect(r).toEqual({ ok: false, error: "account_not_found" });
  });
});

describe("withdrawBet", () => {
  it("取り消すと賭け金が全額戻り、ベットが消える", async () => {
    const repository = getRepository();
    const before = await repository.getAccount(ME);
    const placed = await submitBet(OPEN, ME, { kind: "win", selection: ["t2"], amount: 300 }, now());
    expect(placed.ok).toBe(true);
    const [bet] = await repository.listBets({ marketId: OPEN, studentId: ME });

    const r = await withdrawBet(bet.id, ME, now());
    expect(r.ok).toBe(true);
    const after = await repository.getAccount(ME);
    expect(after?.pointsBalance).toBe(before?.pointsBalance);
    expect(await repository.listBets({ marketId: OPEN, studentId: ME })).toHaveLength(0);
  });

  it("他人のベットは取り消せない（削除もしない）", async () => {
    const repository = getRepository();
    // シードの他生徒のベット（studentId が seed-* のもの）を 1 件使う
    const [foreign] = await repository.listBets({ marketId: OPEN });
    const r = await withdrawBet(foreign.id, ME, now());
    expect(r).toEqual({ ok: false, error: "bet_not_found" });
    expect(await repository.getBet(foreign.id)).not.toBeNull();
  });

  it("配当が確定したベットは取り消せない（払戻と賭け金の二重取りを防ぐ）", async () => {
    const repository = getRepository();
    // race-04-g1 は結果確定済みで、自分のベットに payoutAmount が入っている
    const settledBets = await repository.listBets({ marketId: SETTLED, studentId: ME });
    expect(settledBets.length).toBeGreaterThan(0);
    expect(settledBets[0].payoutAmount).not.toBeNull();
    const before = await repository.getAccount(ME);

    const r = await withdrawBet(settledBets[0].id, ME, now());
    expect(r).toEqual({ ok: false, error: "bet_not_found" });
    expect(await repository.getBet(settledBets[0].id)).not.toBeNull();
    expect((await repository.getAccount(ME))?.pointsBalance).toBe(before?.pointsBalance);
  });

  it("締切後は取り消せない", async () => {
    const repository = getRepository();
    const [closedBet] = await repository.listBets({ marketId: CLOSED, studentId: ME });
    const r = await withdrawBet(closedBet.id, ME, now());
    expect(r).toEqual({ ok: false, error: "market_closed" });
    expect(await repository.getBet(closedBet.id)).not.toBeNull();
  });
});

describe("borrowPoints / repayPoints", () => {
  it("借入れは残高と借金の両方を同額増やす", async () => {
    const repository = getRepository();
    const before = await repository.getAccount(ME);
    const r = await borrowPoints(ME, 200);

    expect(r.ok).toBe(true);
    const after = await repository.getAccount(ME);
    expect(after?.pointsBalance).toBe((before?.pointsBalance ?? 0) + 200);
    expect(after?.debtAmount).toBe((before?.debtAmount ?? 0) + 200);
  });

  it("1回の上限（500）を超える借入れは拒否される", async () => {
    const repository = getRepository();
    const before = await repository.getAccount(ME);
    expect(await borrowPoints(ME, 501)).toEqual({ ok: false, error: "over_borrow_limit" });
    expect(await borrowPoints(ME, 600)).toEqual({ ok: false, error: "over_borrow_limit" });
    // 上限ちょうどは通る
    expect((await borrowPoints(ME, 500)).ok).toBe(true);
    const after = await repository.getAccount(ME);
    expect(after?.debtAmount).toBe((before?.debtAmount ?? 0) + 500);
  });

  it("0・マイナス・小数・文字列の金額は invalid_amount", async () => {
    expect(await borrowPoints(ME, 0)).toEqual({ ok: false, error: "invalid_amount" });
    expect(await borrowPoints(ME, -100)).toEqual({ ok: false, error: "invalid_amount" });
    expect(await borrowPoints(ME, 1.5)).toEqual({ ok: false, error: "invalid_amount" });
    expect(await repayPoints(ME, "100")).toEqual({ ok: false, error: "invalid_amount" });
  });

  it("返済は残高と借金の両方を同額減らす", async () => {
    const repository = getRepository();
    const before = await repository.getAccount(ME);
    const r = await repayPoints(ME, 500);

    expect(r.ok).toBe(true);
    const after = await repository.getAccount(ME);
    expect(after?.pointsBalance).toBe((before?.pointsBalance ?? 0) - 500);
    expect(after?.debtAmount).toBe(0);
  });

  it("借金額を超える返済は over_debt", async () => {
    expect(await repayPoints(ME, 501)).toEqual({ ok: false, error: "over_debt" });
  });

  it("残高を超える返済は insufficient_balance", async () => {
    // 残高を 240 まで減らしてから、借金の範囲内（500以下）だが残高を超える額を返済する
    expect((await submitBet(OPEN, ME, { kind: "win", selection: ["t1"], amount: 1000 }, now())).ok).toBe(true);
    expect(await repayPoints(ME, 300)).toEqual({ ok: false, error: "insufficient_balance" });
  });

  it("最終精算後は借入れ・返済ともできない", async () => {
    const repository = getRepository();
    await repository.updateSettings({ finalSettledAt: new Date().toISOString(), scoresPublishedAt: null });
    expect(await borrowPoints(ME, 100)).toEqual({ ok: false, error: "finalized" });
    expect(await repayPoints(ME, 100)).toEqual({ ok: false, error: "finalized" });
    const view = await getCreditView(ME, now());
    expect(view?.finalized).toBe(true);
  });

  it("口座が無い学籍番号は account_not_found", async () => {
    expect(await borrowPoints(NO_ACCOUNT, 100)).toEqual({ ok: false, error: "account_not_found" });
  });
});

describe("registerAccount", () => {
  it("ユーザーIDは初期ポイント付きで登録できる", async () => {
    const r = await registerAccount(NO_ACCOUNT, "himitsu123", "テスター");
    expect(r).toEqual({ ok: true });
    const account = await getRepository().getAccount(NO_ACCOUNT);
    expect(account?.pointsBalance).toBe(INITIAL_POINTS);
    expect(account?.debtAmount).toBe(0);
    expect(account?.finalBalanceBefore).toBeNull();
    // 平文のパスワードは保存しない
    expect(account?.passwordHash).not.toContain("himitsu123");
  });

  it("既に口座があるユーザーIDは already_registered", async () => {
    expect(await registerAccount(ME, "himitsu123", "テスター")).toEqual({ ok: false, error: "already_registered" });
  });

  it("名簿なしで英数字のID・パスワード・ニックネームを登録し、再ログインして利用できる", async () => {
    await getRepository().replaceStudents([]);
    const userId = "nagata-79_test";
    expect(await registerAccount(userId, "himitsu123", "爆裂太郎")).toEqual({ ok: true });
    expect(await authenticateAccount(userId, "himitsu123")).toEqual({ ok: true });
    expect(await authenticateAccount(userId, "chigau456")).toEqual({ ok: false, error: "wrong_password" });
    expect(await authenticateAccount("Nagata-79_test", "himitsu123")).toEqual({ ok: false, error: "wrong_password" });
    expect(await registerAccount(userId, "another123", "別の人")).toEqual({ ok: false, error: "already_registered" });
    expect((await getRepository().getAccount(userId))?.nickname).toBe("爆裂太郎");
    const bet = await submitBet(OPEN, userId, { kind: "win", selection: ["t1"], amount: 100 }, now());
    expect(bet.ok).toBe(true);
    expect((await getRepository().getAccount(userId))?.pointsBalance).toBe(INITIAL_POINTS - 100);
    expect((await getHistoryView(userId, now()))?.stakeTotal).toBe(100);
  });

  it("同じユーザーIDの同時登録は一方だけ成功し、口座を上書きしない", async () => {
    const results = await Promise.all([
      registerAccount("new_user", "first123", "一人目"),
      registerAccount("new_user", "second123", "二人目"),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toEqual([{ ok: false, error: "already_registered" }]);
  });

  it("不正なユーザーIDでは口座を作らない", async () => {
    for (const userId of ["", "abc", "あいうえ", "a b c", "a.b.c", "a".repeat(33)]) {
      expect(await registerAccount(userId, "himitsu123", "テスター")).toEqual({ ok: false, error: "invalid_user_id" });
      expect(await getRepository().getAccount(userId)).toBeNull();
    }
  });

  it("パスワードが要件を満たさないときは invalid_password", async () => {
    expect(await registerAccount(NO_ACCOUNT, "abc", "テスター")).toEqual({ ok: false, error: "invalid_password" });
    expect(await registerAccount("9999", "abc", "テスター")).toEqual({ ok: false, error: "invalid_password" });
    expect(await getRepository().getAccount(NO_ACCOUNT)).toBeNull();
  });

  it("ニックネームが空・13文字なら invalid_nickname", async () => {
    expect(await registerAccount(NO_ACCOUNT, "himitsu123", "")).toEqual({ ok: false, error: "invalid_nickname" });
    expect(await registerAccount(NO_ACCOUNT, "himitsu123", "あ".repeat(13))).toEqual({
      ok: false,
      error: "invalid_nickname",
    });
    expect(await registerAccount("9999", "himitsu123", "")).toEqual({ ok: false, error: "invalid_nickname" });
    expect(await getRepository().getAccount(NO_ACCOUNT)).toBeNull();
  });

  it("登録したニックネームが口座に保存される", async () => {
    await registerAccount(NO_ACCOUNT, "himitsu123", "テスター");
    const account = await getRepository().getAccount(NO_ACCOUNT);
    expect(account?.nickname).toBe("テスター");
  });
});

describe("authenticateAccount", () => {
  it("正しいパスワードなら認証できる", async () => {
    expect(await authenticateAccount(ME, ME)).toEqual({ ok: true });
  });

  it("パスワードが違うと wrong_password", async () => {
    expect(await authenticateAccount(ME, "chigau456")).toEqual({ ok: false, error: "wrong_password" });
  });

  it("口座が無い学籍番号も wrong_password（口座の有無を漏らさない）", async () => {
    expect(await authenticateAccount(NO_ACCOUNT, "himitsu123")).toEqual({ ok: false, error: "wrong_password" });
    expect(await authenticateAccount("9999", "himitsu123")).toEqual({ ok: false, error: "wrong_password" });
  });
});

describe("表示用データ", () => {
  it("旧DBの三連単倍率が残っていても表示APIは50倍・個別設定なしを返す", async () => {
    const repo = getRepository();
    const stored = (await repo.getMarket(OPEN))!;
    await repo.upsertMarket({ ...stored, trifectaOddsDefault: 336, trifectaOddsOverrides: { "t1>t2>t3": 12.34 } });
    const view = await getMarketView(OPEN, ME, now());
    expect(view?.market.trifectaOddsDefault).toBe(50);
    expect(view?.market.trifectaOddsOverrides).toEqual({});
    expect((await repo.getMarket(OPEN))?.trifectaOddsDefault).toBe(336);
  });

  it("確定済みの旧配当は新しい倍率で再計算せず履歴と残高を保持する", async () => {
    const repo = getRepository();
    const [ticket] = await repo.listBets({ marketId: SETTLED, studentId: ME });
    await repo.updateBetPayouts([{ id: ticket.id, payoutAmount: 173 }]);
    const view = await getMarketView(SETTLED, ME, now());
    expect(view?.myBets.find((b) => b.id === ticket.id)?.payoutAmount).toBe(173);
    const history = await getHistoryView(ME, now());
    expect(history?.groups.find((g) => g.marketId === SETTLED)?.bets.find((b) => b.id === ticket.id)?.payoutAmount).toBe(173);
    expect((await repo.getAccount(ME))?.pointsBalance).toBe(1240);
  });
  it("getCreditView は上限・利率・返済上限を返す", async () => {
    const view = await getCreditView(ME, now());
    expect(view?.borrowMax).toBe(500);
    expect(view?.interestPercent).toBe(10);
    // 返済上限は残高と借金の小さい方
    expect(view?.repayMax).toBe(Math.min(view?.account.pointsBalance ?? 0, view?.account.debtAmount ?? 0));
    expect(view?.finalized).toBe(false);
  });

  it("getHistoryView は Market ごとにまとめ、賭け金・払戻・収支を集計する", async () => {
    const view = await getHistoryView(ME, now());
    expect(view).not.toBeNull();
    const groups = view?.groups ?? [];
    expect(groups.length).toBeGreaterThan(0);
    // シードでは自分のベットがある Market のみが並ぶ
    for (const g of groups) expect(g.bets.length).toBeGreaterThan(0);
    const stake = groups.reduce((a, g) => a + g.stakeTotal, 0);
    const payout = groups.reduce((a, g) => a + g.payoutTotal, 0);
    expect(view?.stakeTotal).toBe(stake);
    expect(view?.payoutTotal).toBe(payout);
    expect(view?.net).toBe(payout - stake);
    // 選択肢は ID ではなく表示名で返す
    const settled = groups.find((g) => g.status === "settled");
    expect(settled?.bets[0].selectionNames[0]).not.toBe("t6");
  });

  it("getHistoryView はベットが無ければ空（口座が無ければ null）", async () => {
    expect(await getHistoryView(NO_ACCOUNT, now())).toBeNull();
    await registerAccount(NO_ACCOUNT, "himitsu123", "テスター");
    const view = await getHistoryView(NO_ACCOUNT, now());
    expect(view?.groups).toEqual([]);
    expect(view?.net).toBe(0);
  });

  it("getRankView は未精算では全体順位表を出さず、自分の順位だけ返す", async () => {
    await registerAccount(NO_ACCOUNT, "himitsu123", "テスター");
    const view = await getRankView(ME, now());
    expect(view?.finalized).toBe(false);
    expect(view?.rows).toEqual([]);
    expect(view?.total).toBe(2);
    // 2117 は 1240 - 500 = 740、新規口座は 1000 なので 2 位
    expect(view?.myNetWorth).toBe(740);
    expect(view?.myRank).toBe(2);
  });

  it("getRankView は最終精算後に全体順位表を返し、自分の行が分かる", async () => {
    const repository = getRepository();
    await registerAccount(NO_ACCOUNT, "himitsu123", "テスター");
    await repository.updateSettings({ finalSettledAt: new Date().toISOString(), scoresPublishedAt: null });
    const view = await getRankView(ME, now());
    expect(view?.finalized).toBe(true);
    expect(view?.rows).toHaveLength(2);
    expect(view?.rows.filter((r) => r.me)).toHaveLength(1);
    expect(view?.rows[0].rank).toBe(1);
    // ニックネームが表示名になる（自分は新規登録時のニックネーム、シード口座は NODE79）
    const byId = new Map(view?.rows.map((r) => [r.studentId, r]));
    expect(byId.get(NO_ACCOUNT)?.displayName).toBe("テスター");
    expect(byId.get(ME)?.displayName).toBe("NODE79");
  });

  it("結果確定済み Market の getMarketView は演出に必要な着順と払戻を返す", async () => {
    const view = await getMarketView(SETTLED, ME, now());
    expect(view?.market.status).toBe("settled");
    // リールが止まる先（上位3着の表示番号）
    const nums = (view?.market.resultOrder ?? []).slice(0, 3).map((id) => view?.market.options.find((o) => o.id === id)?.num);
    expect(nums).toEqual(["02", "06", "01"]);
    // 自分のベットがあり、当落が判定できる状態になっている
    expect(view?.myBets.length).toBeGreaterThan(0);
    for (const b of view?.myBets ?? []) expect(b.payoutAmount).not.toBeNull();
    const payout = (view?.myBets ?? []).reduce((a, b) => a + (b.payoutAmount ?? 0), 0);
    // 2着 t6 の複勝が的中するため HIT 表示になる
    expect(payout).toBeGreaterThan(0);
  });

  it("getMarketView は口座が無ければ null", async () => {
    expect(await getMarketView(OPEN, NO_ACCOUNT, now())).toBeNull();
    expect(await getMarketView("no-such-market", ME, now())).toBeNull();
  });
});
