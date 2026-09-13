"use client";

// Market の勝者を「■ 1組 紅蓮 勝ち」のチップで確定する（モック v2 の「Market の結果確定」）。
// 押したボタンの value が winner として送られる（submit ボタンの name/value を使う）
import { useActionState } from "react";
import type { ActionFn } from "./action-state";
import { ConfirmCheck } from "./ConfirmCheck";

export interface WinnerOption {
  id: string;
  num: string;
  name: string;
  /** チーム色。無ければスウォッチを出さない */
  color?: string;
}

interface Props {
  action: ActionFn;
  options: WinnerOption[];
  /** marketId などの隠しフィールド */
  hidden?: Record<string, string>;
  confirmLabel: string;
}

export function MarketWinnerForm({ action, options, hidden = {}, confirmLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction}>
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            key={option.id}
            type="submit"
            name="winner"
            value={option.id}
            className="adm-btn"
            data-size="sm"
            disabled={pending}
          >
            {option.color !== undefined && (
              <span className="adm-swatch" style={{ background: option.color }} aria-hidden="true" />
            )}
            {option.num} {option.name} 勝ち
          </button>
        ))}
      </div>
      <ConfirmCheck label={confirmLabel} />
      <p role="status" aria-live="polite" className="adm-status" data-ok={state === null ? undefined : state.ok}>
        {pending ? "処理中…" : (state?.message ?? "")}
      </p>
    </form>
  );
}
