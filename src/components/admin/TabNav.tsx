// 管理画面のタブ。黒帯の下に黒／黄のチップを画面幅に合わせて折り返す。
// 現在のタブは見た目（黄色）と aria-current の両方で示す
import Link from "next/link";

export const ADMIN_TABS = [
  { id: "schedule", label: "進行" },
  { id: "results", label: "結果入力" },
  { id: "scores", label: "得点" },
  { id: "teams", label: "チーム" },
  { id: "events", label: "種目" },
  { id: "markets", label: "Market" },
  { id: "invites", label: "CSV取り込み" },
  { id: "final", label: "最終精算" },
] as const;

export type AdminTab = (typeof ADMIN_TABS)[number]["id"];

export const DEFAULT_TAB: AdminTab = "results";

/** ?tab= の値を検証する（未知の値は既定タブに落とす） */
export function toAdminTab(value: string | string[] | undefined): AdminTab {
  const raw = Array.isArray(value) ? value[0] : value;
  return ADMIN_TABS.some((t) => t.id === raw) ? (raw as AdminTab) : DEFAULT_TAB;
}

export function TabNav({ current }: { current: AdminTab }) {
  return (
    <nav aria-label="管理メニュー" className="adm-tabs">
      <ul className="mx-auto grid max-w-5xl grid-cols-2 gap-1 px-3 py-2 sm:grid-cols-4 lg:grid-cols-8">
        {ADMIN_TABS.map((tab) => (
          <li key={tab.id}>
            <Link
              href={`/admin?tab=${tab.id}`}
              aria-current={tab.id === current ? "page" : undefined}
              className="adm-tab"
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
