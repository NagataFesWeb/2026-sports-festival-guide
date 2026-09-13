import type { BetKind } from "@/lib/casino/types";

export const KIND_EN: Record<BetKind, string> = { win: "WIN", place: "PLACE", trifecta: "TRIFECTA" };
export const KIND_JP: Record<BetKind, string> = { win: "単勝", place: "複勝", trifecta: "三連単" };
export const RANKS = ["1ST", "2ND", "3RD"] as const;
