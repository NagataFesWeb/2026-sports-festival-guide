import type { RankingRow } from "@/lib/casino/settlement";
import type { Market } from "@/lib/casino/types";
import type { Event, EventResult, InviteEntry, Settings, Team } from "./types";

/** 表画面専用。ビルド時に取得し、表示中のDBアクセスは行わない。 */
export interface FestivalSnapshot {
  teams: Team[];
  events: Event[];
  results: EventResult[];
  invites: InviteEntry[];
  overall: Market[];
  studentCount: number;
  settings: Settings;
  ranking: RankingRow[];
}
