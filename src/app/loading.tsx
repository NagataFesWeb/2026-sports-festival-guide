// 遷移先の取得中も即座に応答を表示する。ローディング演出とは別の軽い表示。
export default function Loading() {
  return <div role="status" className="min-h-[40vh] bg-om-paper px-6 py-12 font-jp text-om-ink">読み込み中…</div>;
}
