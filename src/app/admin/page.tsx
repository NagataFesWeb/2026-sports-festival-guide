// 実行委員管理画面（/admin）。タブは ?tab= で切り替える
// proxy.ts は粗い門番なので、このページでも requireAdmin() で必ず再検証する
import type { Metadata } from "next";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { EventsTab } from "@/components/admin/EventsTab";
import { FinalTab } from "@/components/admin/FinalTab";
import { InvitesTab } from "@/components/admin/InvitesTab";
import { MarketsTab } from "@/components/admin/MarketsTab";
import { ResultsTab } from "@/components/admin/ResultsTab";
import { ScheduleTab } from "@/components/admin/ScheduleTab";
import { ScoresTab } from "@/components/admin/ScoresTab";
import { TabNav, toAdminTab, type AdminTab } from "@/components/admin/TabNav";
import { TeamsTab } from "@/components/admin/TeamsTab";
import { marketSummaries, settlementPreview } from "@/lib/admin/service";
import { requireAdmin } from "@/lib/auth/session";
import { getRepository } from "@/lib/db";
import { computeStandings } from "@/lib/festival/standings";
import type { Event, Team } from "@/lib/festival/types";
import { logoutAction } from "./actions";

export const metadata: Metadata = {
  title: "実行委員 管理 | 第79回 体育祭",
  robots: { index: false, follow: false },
};

/** ?event=... のような単一値を取り出す */
function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function bySortOrder<T extends { sortOrder: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * プログラム順（sortOrder 昇順 → 同じなら番号の昇順）。
 * schedule.ts の shiftFrom と同じ基準にする（「それ以降がまとめて動く」が表示順と一致するように）
 */
function byProgramOrder(events: Event[]): Event[] {
  return [...events].sort((a, b) => a.sortOrder - b.sortOrder || a.no.localeCompare(b.no, "ja"));
}

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const email = await requireAdmin();
  // 得点・締切・プールは常に最新を表示する（キャッシュしない）
  await connection();

  const params = await searchParams;
  const tab = toAdminTab(params.tab);
  const content = await renderTab(tab, first(params.event));

  return (
    <>
      <header>
        <div className="adm-band">
          <div className="mx-auto flex w-full max-w-5xl flex-wrap items-baseline justify-between gap-3">
            <div>
              <div className="adm-band-label">COMMITTEE CONSOLE</div>
              <h1 className="adm-band-title">実行委員 管理画面</h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="adm-band-meta">{email} としてログイン中</p>
              <form action={logoutAction}>
                <button type="submit" className="adm-btn" data-size="sm" data-tone="dark">
                  ログアウト
                </button>
              </form>
            </div>
          </div>
        </div>
        <TabNav current={tab} />
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-6 pb-24">{content}</main>
    </>
  );
}

/** タブごとの読み込みと描画。AdminTab を網羅する（漏れると型エラーになる） */
async function renderTab(tab: AdminTab, selectedEventId: string | undefined): Promise<ReactNode> {
  const repo = getRepository();

  switch (tab) {
    case "schedule": {
      const events = await repo.listEvents();
      return <ScheduleTab events={byProgramOrder(events)} />;
    }
    case "scores": {
      const [teams, events, results, settings] = await Promise.all([
        repo.listTeams(),
        repo.listEvents(),
        repo.listEventResults(),
        repo.getSettings(),
      ]);
      const sortedTeams = bySortOrder(teams);
      return (
        <ScoresTab
          teams={sortedTeams}
          events={byProgramOrder(events)}
          results={results}
          standings={computeStandings(sortedTeams, results)}
          scoresPublishedAt={settings.scoresPublishedAt}
        />
      );
    }
    case "teams": {
      const teams: Team[] = bySortOrder(await repo.listTeams());
      return <TeamsTab teams={teams} />;
    }
    case "events": {
      const [teams, events, markets] = await Promise.all([repo.listTeams(), repo.listEvents(), repo.listMarkets()]);
      const sortedEvents = byProgramOrder(events);
      return (
        <EventsTab
          events={sortedEvents}
          teams={bySortOrder(teams)}
          markets={markets}
          selected={sortedEvents.find((e) => e.id === selectedEventId) ?? null}
        />
      );
    }
    case "results": {
      const [teams, events, results, markets] = await Promise.all([
        repo.listTeams(),
        repo.listEvents(),
        repo.listEventResults(),
        repo.listMarkets(),
      ]);
      const sortedTeams = bySortOrder(teams);
      return (
        <ResultsTab
          selectedEventId={selectedEventId}
          events={byProgramOrder(events)}
          teams={sortedTeams}
          results={results}
          markets={markets}
          standings={computeStandings(sortedTeams, results)}
        />
      );
    }
    case "markets":
      return <MarketsTab rows={await marketSummaries(repo, new Date())} />;
    case "invites": {
      const [invites, students] = await Promise.all([repo.listInvites(), repo.listStudents()]);
      return <InvitesTab invites={invites} students={students} />;
    }
    case "final":
      return <FinalTab preview={await settlementPreview(repo)} />;
  }
}
