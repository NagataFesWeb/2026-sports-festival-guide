// 最終順位（ランキング）の算出。docs/data-model.md「最終順位（ランキング）ロジック」を参照
import { displayNameOf } from "./nickname";
import type { CasinoAccountRecord } from "./types";

export interface RankingRow {
  rank: number;
  studentId: string;
  name: string;
  /** 表示用の名前（ニックネームがあればそれ、無ければ name） */
  displayName: string;
  /** 純資産（精算済みなら points_balance、未精算なら points_balance - debt_amount） */
  netWorth: number;
  /** 精算直前の所持ポイント（精算済みは finalBalanceBefore、未精算は現在の points_balance） */
  pointsBalance: number;
  /** 精算直前の借金額（精算済みは finalDebt、未精算は現在の debt_amount） */
  debtAmount: number;
}

/**
 * 口座一覧を純資産の降順でランキングする。
 * 純資産が同じ場合は studentId 昇順で安定させたうえで、同順位は同じ rank を共有する（1,1,3方式）。
 */
export function rankAccounts(accounts: readonly CasinoAccountRecord[]): RankingRow[] {
  const rows = accounts.map((a) => {
    const finalized = a.finalBalanceBefore !== null;
    const netWorth = finalized ? a.pointsBalance : a.pointsBalance - a.debtAmount;
    const pointsBalance = finalized ? (a.finalBalanceBefore as number) : a.pointsBalance;
    const debtAmount = finalized ? (a.finalDebt ?? 0) : a.debtAmount;
    // ユーザーIDが学籍番号と一致しても生徒名簿の氏名には結び付けない。
    const name = displayNameOf(a.nickname, a.studentId);
    return {
      studentId: a.studentId,
      name,
      displayName: displayNameOf(a.nickname, name),
      netWorth,
      pointsBalance,
      debtAmount,
    };
  });

  rows.sort((x, y) => y.netWorth - x.netWorth || (x.studentId < y.studentId ? -1 : x.studentId > y.studentId ? 1 : 0));

  const result: RankingRow[] = [];
  let rank = 0;
  let prevNetWorth: number | null = null;
  rows.forEach((row, index) => {
    if (prevNetWorth === null || row.netWorth !== prevNetWorth) {
      rank = index + 1;
      prevNetWorth = row.netWorth;
    }
    result.push({ rank, ...row });
  });
  return result;
}
