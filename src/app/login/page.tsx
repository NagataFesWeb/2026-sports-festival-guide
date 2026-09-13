// 学籍番号の入力。ログイン（本人確認）ではなく、招集案内を探すための検索キーの入力。
// 見た目はモック v2 の黒帯＋クリーム地に合わせる
import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/festival/SiteFooter";
import { StudentIdForm } from "@/components/festival/StudentIdForm";

export const metadata: Metadata = {
  title: "学籍番号の入力 | 長田高校 第79回 体育祭",
};

export default function LoginPage() {
  return (
    <div className="om-page flex min-h-dvh flex-col">
      <div className="relative overflow-hidden bg-om-ink px-[clamp(18px,5vw,60px)] pt-[clamp(46px,7vw,70px)] pb-[clamp(24px,4vw,36px)] text-om-paper">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-[10px] -right-[2vw] font-display text-[clamp(70px,16vw,180px)] leading-none text-[rgba(245,242,233,.06)]"
        >
          LOGIN
        </div>
        <div className="relative mx-auto max-w-[900px]">
          <div className="font-display text-[11px] tracking-[0.34em] text-om-yellow">MY PAGE</div>
          <h1 className="mt-2 mb-0 font-om-mincho text-[clamp(24px,5.4vw,38px)] font-extrabold">
            集合場所をさがす
          </h1>
          <p className="mt-2 mb-0 text-[12.5px] opacity-60">学籍番号だけで開きます。パスワードは要りません。</p>
        </div>
      </div>

      <main className="mx-auto w-full max-w-[900px] flex-1 px-[clamp(18px,5vw,24px)] py-[clamp(20px,3.4vw,32px)]">
        <div className="border-2 border-om-ink bg-white p-5 shadow-[6px_6px_0_#111]">
          <p className="m-0 text-[15px] font-black">これはログインではありません。</p>
          <p className="mt-2 mb-0 text-[13px] leading-[1.9] text-om-gray-1">
            学籍番号を入力すると、その人の集合時間と場所が見られます。パスワードや名前は必要ありません。友だちの番号を入れて確認することもできます。
          </p>
          <StudentIdForm />
        </div>

        <p className="mt-8">
          <Link href="/" className="inline-flex min-h-11 items-center font-display text-[12px] tracking-[0.2em]">
            ← トップにもどる
          </Link>
        </p>
      </main>

      <SiteFooter />
    </div>
  );
}
