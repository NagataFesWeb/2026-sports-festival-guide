import Link from "next/link";

export default function NotFound() {
  return (
    <main className="om-page flex min-h-dvh items-center justify-center bg-om-paper px-5 text-om-ink">
      <div className="w-full max-w-xl border-2 border-om-ink bg-white p-7 shadow-[8px_8px_0_#111]">
        <div className="font-display text-xs tracking-[0.3em] text-om-pink">STATIC PREVIEW</div>
        <h1 className="mt-3 font-om-mincho text-3xl font-extrabold">この機能は暫定公開版では使えません</h1>
        <p className="mt-4 leading-8 text-om-gray-1">
          GitHub Pages 版では、トップページ・プログラム・時刻表だけを公開しています。個人検索、カジノ、管理画面はサーバー版の公開後に利用できます。
        </p>
        <Link href="/" className="mt-6 inline-flex min-h-11 items-center font-display tracking-[0.16em] text-om-pink">
          ← TOP
        </Link>
      </div>
    </main>
  );
}
