// 総合順位は実行委員が確定した並びを表示する。競技の得点から計算しない。
import type { Market } from "@/lib/casino/types";
import { validateCompleteOrder } from "./result-order";
import type { Team } from "./types";

export interface StandingRow { rank: number; team: Team; grade?: number }

/** 全体優勝Marketに保存した全組の順位。未確定・旧来の勝者だけの結果は未入力として扱う。 */
export function overallStandings(teams: readonly Team[], markets: readonly Market[]): StandingRow[] | null {
  const graded = markets.filter(m => m.type === "overall" && /^g[123]$/.test(m.heatId ?? ""));
  if (graded.length > 0) {
    const rows: StandingRow[] = [];
    for (const grade of [1, 2, 3]) {
      const candidates = graded.filter(m => m.heatId === `g${grade}`);
      if (candidates.length !== 1 || candidates[0].status !== "settled") return null;
      const market = candidates[0];
      const ordered = overallStandings(teams, [{ ...market, heatId: null }]);
      if (!ordered) return null;
      rows.push(...ordered.map(row => ({ ...row, grade })));
    }
    return rows;
  }
  const overall = markets.find(m => m.type === "overall" && m.status === "settled");
  const order = overall?.resultOrder;
  if (!order || validateCompleteOrder(order, teams.map(t => t.id))) return null;
  const byId = new Map(teams.map(team => [team.id, team]));
  return order.map((id, index) => ({ rank: index + 1, team: byId.get(id)! }));
}
