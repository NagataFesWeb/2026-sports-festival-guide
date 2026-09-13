// 総合順位（チーム対抗）の集計。表画面のみで使用
import type { EventResult, Team } from "./types";

/**
 * 着順（order）に rankPoints を当てはめて teamId ごとの獲得点を返す。
 * rankPoints の長さが足りない順位は 0 点。EventResult.points を作るときに使う想定
 */
export function pointsFromOrder(order: readonly string[], rankPoints: readonly number[]): Record<string, number> {
  const points: Record<string, number> = {};
  order.forEach((teamId, i) => {
    points[teamId] = rankPoints[i] ?? 0;
  });
  return points;
}

/** 1 種目の得点（ヒートをまたいで合計する）。teamId → 得点 */
export function eventPoints(results: readonly EventResult[], eventId: string): Record<string, number> {
  const points: Record<string, number> = {};
  for (const result of results) {
    if (result.eventId !== eventId) continue;
    for (const [teamId, value] of Object.entries(result.points)) {
      points[teamId] = (points[teamId] ?? 0) + value;
    }
  }
  return points;
}

export interface StandingRow {
  rank: number;
  team: Team;
  points: number;
  /** 1 位（order[0]）になったヒート数。1 種目に複数ヒートあれば最大その数だけ増える */
  wins: number;
}

/**
 * 全ヒートの結果からチームごとの総合成績を集計する。
 * 得点合計の降順、同点は優勝回数（order[0] になったヒート数）の多い順、それも同じなら sortOrder 昇順。
 * 得点が同じチームは同じ順位を共有する（1,1,3方式）
 */
export function computeStandings(teams: readonly Team[], results: readonly EventResult[]): StandingRow[] {
  const rows = teams.map((team) => {
    let points = 0;
    let wins = 0;
    for (const result of results) {
      points += result.points[team.id] ?? 0;
      if (result.order[0] === team.id) wins += 1;
    }
    return { team, points, wins };
  });

  rows.sort(
    (a, b) => b.points - a.points || b.wins - a.wins || a.team.sortOrder - b.team.sortOrder,
  );

  const standing: StandingRow[] = [];
  let rank = 0;
  let prevPoints: number | null = null;
  rows.forEach((row, index) => {
    if (prevPoints === null || row.points !== prevPoints) {
      rank = index + 1;
      prevPoints = row.points;
    }
    standing.push({ rank, ...row });
  });
  return standing;
}
