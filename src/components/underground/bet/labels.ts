import type { BetKind } from "@/lib/casino/types";

export const KIND_EN: Record<BetKind, string> = { win: "WIN", place: "PLACE", trifecta: "TRIFECTA" };
export const KIND_JP: Record<BetKind, string> = { win: "単勝", place: "複勝", trifecta: "三連単" };
export const KIND_DESCRIPTION: Record<BetKind, string> = {
  win: "1つの組を選び、1着になれば的中。",
  place: "1つの組を選び、3着以内に入れば的中。",
  trifecta: "1〜3着の組を選び、順番まで一致すれば的中。",
};
export const RANKS = ["1ST", "2ND", "3RD"] as const;
