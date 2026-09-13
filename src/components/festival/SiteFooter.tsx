// フッター。「79」だけが隠しボタン（HiddenDoor）で、ほかに裏画面への導線は置かない
import { HiddenDoor } from "./HiddenDoor";

/** 黒地のフッター（トップ・ログイン・ランキング） */
export function SiteFooter() {
  return (
    <footer className="bg-om-ink px-[clamp(18px,5vw,60px)] pt-[30px] pb-10 text-[rgba(245,242,233,.4)]">
      <div className="mx-auto flex max-w-[1080px] flex-wrap items-center justify-between gap-[14px] text-[11px]">
        <div className="font-display tracking-[0.28em] text-[rgba(245,242,233,.75)]">
          NAGATA <HiddenDoor tone="dark" />TH ・ 2026
        </div>
        <div className="flex items-center gap-[14px]">
          <span>実行委員会</span>
          <span>・</span>
          <span>校内限定公開</span>
        </div>
      </div>
    </footer>
  );
}

/** クリーム地の薄いフッター（マイページ） */
export function PaperFooter() {
  return (
    <div className="text-center font-display text-[10px] tracking-[0.28em] text-[rgba(17,17,17,.3)]">
      NAGATA <HiddenDoor tone="light" />TH
    </div>
  );
}
