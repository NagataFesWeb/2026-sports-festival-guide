"use client";

// 管理画面の汎用フォーム。送信中の表示と role="status" の結果表示をここに集約する
import { useActionState, type ReactNode } from "react";
import type { ActionFn, ActionState } from "./action-state";

/** ボタンの調子。primary=黄（実行）/ ghost=補助 / dark=黒地に黄 / danger=ピンク（取り消せない操作） */
export type ButtonTone = "primary" | "ghost" | "dark" | "danger";

interface SubmitRowProps {
  pending: boolean;
  label: string;
  tone?: ButtonTone;
  state: ActionState | null;
  inline?: boolean;
}

/** 送信ボタンと結果表示。live region は常に DOM に置く（後から出現すると読み上げられない） */
export function SubmitRow({ pending, label, tone = "primary", state, inline = false }: SubmitRowProps) {
  return (
    <div className={inline ? "flex flex-wrap items-center gap-2" : "mt-3 flex flex-wrap items-center gap-3"}>
      <button type="submit" className="adm-btn" data-tone={tone} disabled={pending}>
        {pending ? "処理中…" : label}
      </button>
      <p role="status" aria-live="polite" className="adm-status" data-ok={state === null ? undefined : state.ok}>
        {state?.message ?? ""}
      </p>
    </div>
  );
}

interface Props {
  action: ActionFn;
  submitLabel: string;
  /** 入力欄など。省略すると隠しフィールドなしのボタンだけになる */
  children?: ReactNode;
  tone?: ButtonTone;
  className?: string;
  /** true: 入力欄とボタンを 1 行に並べる（表の行内で使う） */
  inline?: boolean;
  /** 認証後はCookieを付けて新しく画面を取得する。 */
  successRedirect?: string;
}

export function ActionForm({ action, submitLabel, children, tone = "primary", className, inline = false, successRedirect }: Props) {
  const [state, formAction, pending] = useActionState(async (prev: ActionState | null, data: FormData) => {
    const result = await action(prev, data);
    if (result.ok && successRedirect) window.location.assign(successRedirect);
    return result;
  }, null);

  return (
    <form action={formAction} className={inline ? `flex flex-wrap items-end gap-2 ${className ?? ""}` : className}>
      {children}
      <SubmitRow pending={pending} label={submitLabel} tone={tone} state={state} inline={inline} />
    </form>
  );
}
