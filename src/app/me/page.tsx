// 招集案内（機能3・4）。モック v2「爆裂」の isMe をそのまま移植したもの。
// 学籍番号は検索キーなので、他人の番号でも同じように表示する。
// 「自分の出場競技」は静的データ（出場競技表）だけで描くので DB を待たずに出し、
// 実行委員の更新を反映する DB 由来のセクションは Suspense で後から流し込む
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
import { ENTRY_DATA_VERSION, findStudentEntries, studentIdParts } from "@/lib/festival/entries";
import { getMePageData, normalizeStudentId } from "@/lib/festival/queries";

export const metadata: Metadata = {
  title: "招集案内 | 長田高校 第79回 体育祭",
};

/** 招集案内の行の左ボーダー色（モックの accent。ピンク→黄→青の繰り返し） */
const ACCENTS: string[] = ["#FF2D55", "#FFE600", "#245BFF"];

const SECTION_HEADING = "m-0 mb-1 font-om-mincho text-[clamp(20px,4vw,28px)] font-extrabold";
/** 見出しの下の一言。3 つのセクションに同じ種目名が並ぶので、それぞれの役割を書き分ける */
const SECTION_NOTE = "mb-3 text-[12px] text-om-gray-2";

/**
 * DB 由来のデータ。黒帯の所属表示と下のセクションの 2 か所から呼ぶので、
 * cache() で 1 リクエストにつき 1 回だけ取りに行く
 */
const loadMePageData = cache(async (studentId: string) => {
  // 招集案内は実行委員の更新を即時に反映する
  await connection();
  return getMePageData(studentId);
});

export default async function MePage({ searchParams }: PageProps<"/me">) {
  const { id } = await searchParams;
  // ?id=1&id=2 のように複数来た場合は先頭だけを見る
  const raw = Array.isArray(id) ? id[0] : id;
  const studentId = normalizeStudentId(raw ?? "");
  if (studentId === null) redirect("/login");

  // ここは DB を使わない。学籍番号を入れた直後に必ず出したい情報
  const entries = findStudentEntries(studentId);
  const parts = studentIdParts(studentId);
  const staticIdentity = parts === null ? null : `${parts.grade}年${parts.classNo}組`;

  return (
    <div className="om-page pb-[90px]">
      <div className="relative overflow-hidden bg-om-ink px-[clamp(18px,5vw,60px)] pt-[clamp(46px,7vw,70px)] pb-[clamp(24px,4vw,36px)] text-om-paper">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-[10px] -right-[2vw] font-display text-[clamp(70px,16vw,180px)] leading-none text-[rgba(245,242,233,.06)]"
        >
          MY PAGE
        </div>
        <div className="relative mx-auto max-w-[900px]">
          <div className="font-display text-[11px] tracking-[0.34em] text-om-yellow">MY PAGE</div>
          <div className="mt-2 flex flex-wrap items-end gap-3">
            <div>
              <div className="text-[10px] font-black tracking-[0.24em] text-[rgba(245,242,233,.5)]">学籍番号</div>
              <div className="font-display text-[clamp(28px,6vw,44px)] leading-[1.1] tracking-[0.06em]">
                {studentId}
              </div>
            </div>
            {/* 学年・組は学籍番号から先に出し、チーム名・氏名（名簿＝DB）は届き次第そこに足す */}
            <Suspense fallback={<IdentityLine text={staticIdentity} />}>
              <IdentityFromRoster studentId={studentId} fallback={staticIdentity} />
            </Suspense>
          </div>
        </div>
      </div>

      <div className="mx-auto grid min-w-0 max-w-[900px] gap-6 px-[clamp(18px,5vw,24px)] py-[clamp(20px,3.4vw,32px)]">
        <MyEntries key={studentId} studentId={studentId} entries={entries} version={ENTRY_DATA_VERSION} />

        <Suspense fallback={<CallSectionsFallback />}>
          <CallSections studentId={studentId} />
        </Suspense>

        <section className="min-w-0 border-2 border-om-ink bg-white p-4">
          <h2 className="m-0 mb-3 text-[14px] font-black">別の学籍番号で確認</h2>
          <IdSearchForm tone="page" buttonLabel="CHECK →" defaultValue={studentId} inputId="me-student-id" />
        </section>

        <p className="m-0">
          <Link href="/" className="inline-flex min-h-11 items-center font-display text-[12px] tracking-[0.2em]">
            ← トップにもどる
          </Link>
        </p>

        <PaperFooter />
      </div>
    </div>
  );
}

/** 黒帯の「2年1組 ・ 1組 紅蓮 ・ サンプル生徒04」。出すものが無ければ何も描かない */
function IdentityLine({ text }: { text: string | null }) {
  if (text === null) return null;
  return <div className="pb-[6px] text-[12px] font-bold opacity-65">{text}</div>;
}

/** 名簿（DB）から所属を引く。名簿に無ければ学籍番号から読んだ学年・組だけを出す */
async function IdentityFromRoster({ studentId, fallback }: { studentId: string; fallback: string | null }) {
  const { student } = await loadMePageData(studentId);
  if (student === null) return <IdentityLine text={fallback} />;

  const identity: string[] = [];
  if (student.grade !== null && student.classNo !== null) identity.push(`${student.grade}年${student.classNo}組`);
  else if (fallback !== null) identity.push(fallback);
  if (student.team !== null) identity.push(student.team.name);
  identity.push(student.name);
  return <IdentityLine text={identity.join(" ・ ")} />;
}

/** DB を待っている間の場所取り。高さが大きく動かないように枠だけ出す */
function CallSectionsFallback() {
  return (
    <section className="min-w-0" aria-busy="true">
      <h2 className={SECTION_HEADING}>自分の招集案内</h2>
      <div className={SECTION_NOTE}>実行委員が出す集合時間・場所・持ち物です。</div>
      <div className="border border-[rgba(17,17,17,.15)] bg-white px-4 py-[13px] text-[12.5px] text-om-gray-2">
        読み込み中…
      </div>
    </section>
  );
}

/** 実行委員が更新する側（招集案内・プログラム・種目別 招集案内）。DB を読むので Suspense の内側に置く */
async function CallSections({ studentId }: { studentId: string }) {
  const { student, invites, myEvents, events, starts, teams } = await loadMePageData(studentId);

  // 時刻の整形はサーバー側で済ませる
  const times: Record<string, string | null> = {};
  for (const event of events) times[event.id] = formatHourMinute(starts[event.id]);

  // 招集案内は種目名で紐づくので、種目 ID → 集合時間に直しておく
  const callTimes: Record<string, string> = {};
  for (const invite of invites) {
    const matched = events.find((event) => event.name === invite.eventName);
    if (matched !== undefined) callTimes[matched.id] = invite.gatherTime;
  }

  return (
    <>
      <section className="min-w-0">
        <h2 className={SECTION_HEADING}>自分の招集案内</h2>
        <div className={SECTION_NOTE}>実行委員が出す集合時間・場所・持ち物です。</div>
        {invites.length > 0 ? (
          <div className="grid gap-[6px]">
            {invites.map((invite, index) => (
              <div
                key={invite.id}
                style={{ borderLeftColor: ACCENTS[index % ACCENTS.length] }}
                className="grid grid-cols-[auto_1fr_auto] items-center gap-[14px] border border-[rgba(17,17,17,.15)] border-l-[6px] bg-white px-4 py-[13px]"
              >
                <div className="font-display text-[26px] leading-none">{invite.gatherTime || "未定"}</div>
                <div className="min-w-0">
                  <div className="text-[14px] font-black">{invite.eventName}</div>
                  <div className="mt-[2px] text-[12px] text-om-gray-2">{invite.location || "未定"}</div>
                </div>
                {invite.tag !== "" ? (
                  <div
                    className={`px-[9px] py-[5px] text-[10px] font-black whitespace-nowrap ${
                      index === 0 ? "bg-om-pink text-white" : "bg-[rgba(17,17,17,.08)] text-om-gray-2"
                    }`}
                  >
                    {invite.tag}
                  </div>
                ) : (
                  <div />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="border-2 border-om-ink bg-white p-4">
            <p className="m-0 text-[15px] font-black">現在、招集案内はありません</p>
            <p className="mt-2 mb-0 text-[12.5px] leading-[1.9] text-om-gray-2">
              追加されると、この画面に出ます。時間をおいてもう一度確認してください。番号の入力ちがいもご確認ください。
            </p>
          </div>
        )}
      </section>

      {myEvents.length > 0 ? (
        <section className="min-w-0">
          <h2 className={SECTION_HEADING}>出場種目</h2>
          <div className={SECTION_NOTE}>プログラム番号と開始予定時刻です。</div>
          <div className="grid gap-[6px]">
            {myEvents.map((event) => (
              <div
                key={event.id}
                className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border border-[rgba(17,17,17,.15)] bg-white px-[15px] py-3"
              >
                <div className="font-display text-[22px] text-om-pink">{event.no}</div>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-black">{event.name}</div>
                  <div className="mt-[2px] font-display text-[10px] tracking-[0.18em] text-om-gray-3">{event.en}</div>
                </div>
                <div className="text-[11px] font-black text-om-gray-2">{times[event.id] ?? "未定"}</div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <CallGuide
        events={events}
        times={times}
        callTimes={callTimes}
        myEventIds={myEvents.map((event) => event.id)}
        teams={teams}
        myTeamId={student?.team?.id ?? null}
      />
    </>
  );
}
