// 最終順位（機能9）。モック v2「爆裂」の isRanking をそのまま移植したもの。
// 最終精算が終わるまでは公開しない
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { getRankingData } from "@/lib/festival/queries";

export const metadata: Metadata = {
  title: "最終順位 | 長田高校 第79回 体育祭",
};

/** 数値を 3 桁区切りで表示する（負の値には符号が付く） */
function formatNumber(value: number): string {
  return value.toLocaleString("ja-JP");
}

export default async function RankingPage() {
  // 最終精算の有無を毎リクエストで確かめる（ビルド時の値を固めない）
  await connection();
  const { finalSettledAt, rows } = await getRankingData();

  return (
    <div className="om-page flex min-h-dvh flex-col pb-[90px]">
      <div className="relative overflow-hidden bg-om-ink px-[clamp(18px,5vw,60px)] pt-[clamp(48px,7vw,80px)] pb-[clamp(26px,4vw,40px)] text-om-paper">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-display text-[clamp(80px,20vw,240px)] leading-none whitespace-nowrap text-[rgba(255,45,85,.14)]"
        >
          FINAL
        </div>
        <div className="relative text-center">
          <div className="font-display text-[11px] tracking-[0.34em] text-om-yellow">FINAL STANDINGS</div>
          <h1 className="mt-[10px] mb-0 font-om-mincho text-[clamp(26px,6vw,44px)] font-extrabold">
            最終順位ランキング
          </h1>
          <div className="mt-2 text-[12px] opacity-60">純資産（所持ポイント − 借金額）順</div>
        </div>
      </div>

      <main className="flex-1">
        {finalSettledAt === null || rows.length === 0 ? (
          <div className="mx-auto my-[clamp(30px,6vw,60px)] max-w-[520px] px-[18px] text-center">
            <div className="border-2 border-dashed border-[rgba(17,17,17,.25)] bg-white px-6 py-9">
              <div className="font-display text-[44px] leading-none">LOCKED</div>
              <div className="mt-3 text-[16px] font-black">体育祭終了後に公開されます</div>
              <div className="mt-2 text-[12.5px] leading-[1.8] text-om-gray-2">
                実行委員が最終集計を終えると、全員の純資産ランキングが出ます。
              </div>
              <p className="mt-[18px] mb-0">
                <Link
                  href="/"
                  className="inline-flex min-h-11 items-center border-2 border-om-ink bg-om-yellow px-5 font-display text-[13px] tracking-[0.14em] text-om-ink shadow-[4px_4px_0_#111]"
                >
                  トップにもどる →
                </Link>
              </p>
            </div>
          </div>
        ) : (
          <div className="mx-auto grid max-w-[760px] gap-[6px] px-[18px] py-[clamp(20px,4vw,34px)]">
            {rows.map((row) => (
              <div
                key={row.studentId}
                className="om-rise grid grid-cols-[56px_1fr_auto] items-center gap-3 border-2 border-[rgba(17,17,17,.14)] bg-white px-[15px] py-[13px]"
              >
                <div
                  className={`text-center font-display leading-none ${
                    row.rank === 1
                      ? "text-[30px] text-om-pink"
                      : row.rank <= 3
                        ? "text-[30px] text-om-ink"
                        : "text-[22px] text-[#b8b3aa]"
                  }`}
                >
                  {String(row.rank).padStart(2, "0")}
                </div>
                <div className="min-w-0">
                  <div className="text-[14px] font-black break-words">
                    {row.displayName}
                    <span className="ml-[7px] break-all font-display text-[11px] font-bold text-om-gray-3">
                      {row.studentId}
                    </span>
                  </div>
                  <div className="mt-[3px] text-[11px] text-om-gray-2">
                    所持 {formatNumber(row.pointsBalance)} pt ・ 借入 {formatNumber(row.debtAmount)} pt
                  </div>
                </div>
                <div className="text-right whitespace-nowrap">
                  <span
                    className={`font-display text-[26px] ${row.netWorth < 0 ? "text-om-pink" : "text-om-ink"}`}
                  >
                    {formatNumber(row.netWorth)}
                  </span>
                  <span className="ml-[2px] text-[11px] text-om-gray-3">PT</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
