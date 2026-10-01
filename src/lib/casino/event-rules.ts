// 騎馬戦の予想・結果はクラス別ではなく紅白で扱う。
import type { MarketOption } from "./types";

export const HORSE_OPTIONS: MarketOption[] = [
  { id: "red", num: "RED", name: "紅組" },
  { id: "white", num: "WHITE", name: "白組" },
];

export function isHorseEvent(event: { name: string; formation?: string }): boolean {
  return event.formation === "horse" || event.name.includes("騎馬戦");
}
