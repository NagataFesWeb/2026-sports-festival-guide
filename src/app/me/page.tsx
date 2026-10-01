// 個人の出場枠はDBを待たず表示し、実行委員の更新を同じカードに反映する。
import { Suspense, cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { CallGuide } from "@/components/festival/CallGuide";
import { formatHourMinute } from "@/components/festival/format";
import { IdSearchForm } from "@/components/festival/IdSearchForm";
import { MyEntries } from "@/components/festival/MyEntries";
import { PaperFooter } from "@/components/festival/SiteFooter";
import { findStudentEntries, studentIdParts, type StudentEntry } from "@/lib/festival/entries";
import { personalAgenda } from "@/lib/festival/ledger";
import { getMePageData, normalizeStudentId } from "@/lib/festival/queries";

export const metadata: Metadata = { title: "自分の当日案内 | 長田高校 第79回 体育祭" };
const loadMePageData = cache(async (studentId: string) => {
  await connection();
  return getMePageData(studentId);
});

export default async function MePage({ searchParams }: PageProps<"/me">) {
  const { id } = await searchParams;
  const studentId = normalizeStudentId((Array.isArray(id) ? id[0] : id) ?? "");
  if (studentId === null) redirect("/login");
  const entries = findStudentEntries(studentId);
  const parts = studentIdParts(studentId);
  const identity = parts ? `${parts.grade}年${parts.classNo}組` : null;
  return <div className="om-page pb-[90px]">
    <header className="bg-om-ink px-[clamp(18px,5vw,60px)] py-6 text-om-paper">
      <div className="mx-auto max-w-[900px]">
        <div className="text-[14px] font-bold text-om-yellow">自分の当日案内</div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className="font-display text-[32px]">{studentId}</span>
          <Suspense fallback={<IdentityLine text={identity}/>}><IdentityFromRoster studentId={studentId} fallback={identity}/></Suspense>
        </div>
      </div>
    </header>
    <main className="mx-auto grid min-w-0 max-w-[900px] gap-6 px-[clamp(18px,5vw,24px)] py-6">
      <Suspense fallback={<MyEntries studentId={studentId} entries={entries} agenda={personalAgenda(studentId, entries)} updating/>}>
        <PersonalSchedule studentId={studentId} entries={entries}/>
      </Suspense>
      <details className="min-w-0 border-t border-om-line pt-3">
        <summary className="min-h-11 cursor-pointer py-3 text-[16px] font-bold">ほかの人の案内を確認する</summary>
        <p className="my-3 text-[16px] leading-relaxed">学籍番号が分かる場合は入力してください。</p>
        <IdSearchForm tone="page" buttonLabel="案内を見る →" defaultValue={studentId} inputId="me-student-id"/>
        <details className="mt-6 min-w-0 border-t border-om-line pt-3">
          <summary className="min-h-11 cursor-pointer py-3 text-[16px] font-bold">学籍番号が分からないとき：競技から探す</summary>
          <Suspense fallback={<p role="status">競技一覧を読み込み中…</p>}><OtherCompetitions studentId={studentId}/></Suspense>
        </details>
      </details>
      <p className="m-0"><Link href="/" className="inline-flex min-h-11 items-center text-[16px] font-bold">← 体育祭トップへ</Link></p>
      <PaperFooter/>
    </main>
  </div>;
}

function IdentityLine({ text }: { text: string | null }) {
  return text ? <span className="text-[16px] font-bold">{text}</span> : null;
}
async function IdentityFromRoster({ studentId, fallback }: { studentId: string; fallback: string | null }) {
  const { student } = await loadMePageData(studentId);
  if (!student) return <IdentityLine text={fallback}/>;
  const identity = [student.grade && student.classNo ? `${student.grade}年${student.classNo}組` : fallback, student.team?.name, student.name].filter(Boolean).join(" ・ ");
  return <IdentityLine text={identity}/>;
}
async function PersonalSchedule({ studentId, entries }: { studentId: string; entries: StudentEntry[] | null }) {
  const { events, invites, starts } = await loadMePageData(studentId);
  return <MyEntries key={studentId} studentId={studentId} entries={entries} agenda={personalAgenda(studentId, entries, events, invites, starts)}/>;
}
async function OtherCompetitions({ studentId }: { studentId: string }) {
  const { events, starts, teams } = await loadMePageData(studentId);
  const times = Object.fromEntries(events.map(event => [event.id, formatHourMinute(starts[event.id])]));
  // 個人の招集時刻を別競技の共通時刻として流用しない。
  return <CallGuide events={events} times={times} callTimes={{}} myEventIds={[]} teams={teams} myTeamId={null}/>;
}
