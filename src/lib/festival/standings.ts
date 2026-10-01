// 総合順位は実行委員が確定した並びを表示する。競技の得点から計算しない。
import type { Market } from "@/lib/casino/types";
import { validateCompleteOrder } from "./result-order";
import type { Team } from "./types";

export interface StandingRow { rank: number; team: Team }

/** 全体優勝Marketに保存した全組の順位。未確定・旧来の勝者だけの結果は未入力として扱う。 */
export function overallStandings(teams: readonly Team[], markets: readonly Market[]): StandingRow[] | null {
  const overall = markets.find(m => m.type === "overall" && m.status === "settled");
  const order = overall?.resultOrder;
  if (!order || validateCompleteOrder(order, teams.map(t => t.id))) return null;
  const byId = new Map(teams.map(team => [team.id, team]));
  return order.map((id, index) => ({ rank: index + 1, team: byId.get(id)! }));
}
