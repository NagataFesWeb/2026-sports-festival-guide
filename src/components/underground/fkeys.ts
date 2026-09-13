// F1〜F4（セクション切替）の割り当て。4 つとも押せて、現在のセクションだけラッチ表示にする
import type { LcdTab } from "./Lcd";
import type { FKey } from "./HardwareControls";

export type CasinoSection = "market" | "credit" | "history" | "rank";

/** セクション → パス。F キーと LCD タブで共有する */
export const SECTION_PATH: Record<CasinoSection, string> = {
  market: "/casino",
  credit: "/casino/credit",
  history: "/casino/history",
  rank: "/casino/rank",
};

const SECTION_LABEL: Record<CasinoSection, string> = {
  market: "MARKET",
  credit: "CREDIT",
  history: "HISTORY",
  rank: "RANK",
};

const ORDER: CasinoSection[] = ["market", "credit", "history", "rank"];
const KEY_CODES = ["F1", "F2", "F3", "F4"] as const;

/** router は next/navigation の useRouter() を渡す（push だけ使う） */
export interface SectionNav {
  push: (href: string) => void;
}

export function casinoFKeys(active: CasinoSection, router: SectionNav): FKey[] {
  return ORDER.map((section, i) => ({
    code: KEY_CODES[i],
    label: SECTION_LABEL[section],
    latched: section === active,
    onPress: () => router.push(SECTION_PATH[section]),
  }));
}

export function LCD_TABS(active: CasinoSection): LcdTab[] {
  return ORDER.map((section, i) => ({
    label: `${KEY_CODES[i]} ${SECTION_LABEL[section]}`,
    active: section === active,
  }));
}

/** F1〜F4 のキーボード操作。担当セクションのパスへ遷移する（該当キー以外は false） */
export function handleSectionKey(key: string, router: SectionNav): boolean {
  const i = (KEY_CODES as readonly string[]).indexOf(key);
  if (i < 0) return false;
  router.push(SECTION_PATH[ORDER[i]]);
  return true;
}
