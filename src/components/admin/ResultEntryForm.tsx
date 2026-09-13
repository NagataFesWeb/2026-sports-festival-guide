"use client";

// 着順の入力フォーム（順位点がある種目のヒートの確定に使う）。
// 得点は src/lib/festival/standings.ts の pointsFromOrder で計算する（この画面では計算式を持たない）
import { useActionState, useState } from "react";
import { pointsFromOrder } from "@/lib/festival/standings";
import type { ActionFn } from "./action-state";
import { SubmitRow } from "./ActionForm";
import { ConfirmCheck } from "./ConfirmCheck";

export interface OrderOption {
  id: string;
  num: string;
  name: string;
}

interface Props {
  action: ActionFn;
  options: OrderOption[];
  /** 着順の入力欄の数 */
  slots: number;
  /** 空欄を許さない先頭の欄数（race は 3、field は 1） */
  requiredCount: number;
  defaultOrder?: string[];
  /** 順位点。null なら得点欄を出さない */
  rankPoints: number[] | null;
  /** eventId・heatId などの隠しフィールド */
  hidden?: Record<string, string>;
  submitLabel: string;
  confirmLabel: string;
}

export function ResultEntryForm({
  action,
  options,
  slots,
  requiredCount,
  defaultOrder = [],
  rankPoints,
  hidden = {},
  submitLabel,
  confirmLabel,
}: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  const [order, setOrder] = useState<string[]>(() => Array.from({ length: slots }, (_, i) => defaultOrder[i] ?? ""));
  const [override, setOverride] = useState(false);
  const [manual, setManual] = useState<string[]>(() => Array.from({ length: slots }, () => ""));

  // 入力済みの着順から順位点を割り当てる（プレビュー）
  const points = rankPoints === null ? {} : pointsFromOrder(order.filter((id) => id !== ""), rankPoints);
  const autoValue = (i: number): string => {
    const teamId = order[i];
    if (rankPoints === null || teamId === "") return "";
    return String(points[teamId] ?? 0);
  };

  function selectAt(index: number, value: string): void {
    setOrder((prev) => prev.map((v, i) => (i === index ? value : v)));
  }

  function toggleOverride(next: boolean): void {
    // 手入力に切り替えた時点の自動計算値を初期値にする
    if (next) setManual(Array.from({ length: slots }, (_, i) => autoValue(i)));
    setOverride(next);
  }

  return (
    <form action={formAction}>
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      <div className="grid gap-2 sm:grid-cols-2">
        {order.map((selected, i) => (
          <div key={i} className="flex flex-wrap items-end gap-2">
            <label className="adm-field min-w-0 flex-1 basis-40">
              <span>
                {i + 1}位{i < requiredCount ? "（必須）" : ""}
              </span>
              <select
                className="adm-input"
                name="order"
                value={selected}
                required={i < requiredCount}
                onChange={(e) => selectAt(i, e.target.value)}
              >
                <option value="">―</option>
                {options.map((option) => (
                  <option
                    key={option.id}
                    value={option.id}
                    // 同じ対象を 2 つの順位に選べないようにする
                    disabled={option.id !== selected && order.includes(option.id)}
                  >
                    {option.num} {option.name}
                  </option>
                ))}
              </select>
            </label>
            {rankPoints !== null && (
              <label className="adm-field basis-24">
                <span>{override ? "得点(手入力)" : "得点(自動)"}</span>
                <input
                  className="adm-input"
                  type="text"
                  name="points"
                  inputMode="numeric"
                  readOnly={!override}
                  value={override ? (manual[i] ?? "") : autoValue(i)}
                  onChange={(e) => setManual((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))}
                />
              </label>
            )}
          </div>
        ))}
      </div>

      {rankPoints !== null && (
        <label className="adm-check mt-1">
          <input type="checkbox" name="override" checked={override} onChange={(e) => toggleOverride(e.target.checked)} />
          <span>得点を手入力する（順位点の自動計算を使わない）</span>
        </label>
      )}

      <div className="grid">
        <ConfirmCheck label={confirmLabel} />
      </div>
      <SubmitRow pending={pending} label={submitLabel} state={state} />
    </form>
  );
}
