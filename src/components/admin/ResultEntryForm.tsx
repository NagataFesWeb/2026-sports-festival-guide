"use client";

// 全組を順位順に並べ、確認画面から確定する。得点は扱わない。
import { useActionState, useRef, useState, type PointerEvent } from "react";
import { initialOrder, moveOrder } from "@/lib/festival/result-order";
import type { ActionFn, ActionState } from "./action-state";
import { runResultAction } from "./result-action";

export interface OrderOption { id: string; num: string; name: string; color?: string }
interface Props {
  action: ActionFn;
  options: OrderOption[];
  defaultOrder?: string[];
  hidden?: Record<string, string>;
  confirmLabel: string;
}

export function ResultEntryForm({ action, options, defaultOrder = [], hidden = {}, confirmLabel }: Props) {
  const [state, formAction, pending] = useActionState((previous: ActionState | null, data: FormData) => runResultAction(action, previous, data), null);
  const [order, setOrder] = useState(() => initialOrder(options.map(o => o.id), defaultOrder));
  const [review, setReview] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null);
  const list = useRef<HTMLOListElement>(null);
  const dragTarget = useRef<number | null>(null);
  const byId = new Map(options.map(o => [o.id, o]));

  function move(from: number, to: number) {
    if (from === to || to < 0 || to >= order.length) return;
    setOrder(prev => moveOrder(prev, from, to));
    setAnnouncement(`${byId.get(order[from])?.name ?? "組"}を${to + 1}位に移動しました`);
  }
  function startDrag(event: PointerEvent<HTMLButtonElement>, from: number) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragTarget.current = from;
    setDrag({ from, to: from });
  }
  function updateDrag(event: PointerEvent<HTMLButtonElement>) {
    if (!drag || !list.current) return;
    const rows = Array.from(list.current.children);
    const target = rows.findIndex(row => event.clientY < row.getBoundingClientRect().bottom);
    const to = target === -1 ? order.length - 1 : target;
    dragTarget.current = to;
    setDrag({ from: drag.from, to });
  }
  function finishDrag(event: PointerEvent<HTMLButtonElement>) {
    if (drag) move(drag.from, dragTarget.current ?? drag.from);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    dragTarget.current = null;
    setDrag(null);
  }

  return (
    <form action={formAction} onSubmit={event => { if (!review) event.preventDefault(); }}>
      {Object.entries(hidden).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      {order.map(id => <input key={id} type="hidden" name="order" value={id} />)}
      {review && <input type="hidden" name="confirm" value="on" />}
      <p className="adm-note mb-2">
        {options.length === 2 ? (review ? "上の組が勝者です。確認して確定してください。" : "勝った組を上にしてください。↑↓で並べ替えられます。") :
          review ? "上から1位〜8位です。組と順位を確認して確定してください。" : "上から1位〜8位。左のつまみをドラッグするか、↑↓で並べ替えてください。"}
      </p>
      <fieldset disabled={pending}>
        <ol ref={list} className="adm-order-list" aria-label="順位の並べ替え">
          {order.map((id, index) => {
            const option = byId.get(id);
            if (!option) return null;
            return <li key={id} className="adm-order-row" data-target={drag?.to === index ? "true" : undefined}>
              {!review && <button type="button" className="adm-btn adm-order-handle" aria-label={`${option.name}をドラッグして移動`}
                onPointerDown={event => startDrag(event, index)} onPointerMove={updateDrag} onPointerUp={finishDrag}
                onPointerCancel={() => { dragTarget.current = null; setDrag(null); }}
                onKeyDown={event => {
                  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                    event.preventDefault();
                    move(index, index + (event.key === "ArrowUp" ? -1 : 1));
                  }
                }}>↕</button>}
              <span className="adm-num">{index + 1}位</span>
              <span className="adm-order-name">
                {option.color && <span className="adm-swatch" style={{ background: option.color }} aria-hidden="true" />}
                {option.name}
              </span>
              {!review && <span className="flex gap-1">
                <button type="button" className="adm-btn adm-order-move" disabled={index === 0} aria-label={`${option.name}を上へ`} onClick={() => move(index, index - 1)}>↑</button>
                <button type="button" className="adm-btn adm-order-move" disabled={index === order.length - 1} aria-label={`${option.name}を下へ`} onClick={() => move(index, index + 1)}>↓</button>
              </span>}
            </li>;
          })}
        </ol>
        <div className="mt-3 flex flex-wrap gap-2">
          {review ? <>
            <p className="adm-note w-full">{confirmLabel}</p>
            <button type="button" className="adm-btn" onClick={() => setReview(false)}>並べ替えに戻る</button>
            <button type="submit" className="adm-btn" data-tone="primary">{pending ? "処理中…" : "この順で確定する"}</button>
          </> : <button type="button" className="adm-btn" data-tone="primary" disabled={order.length === 0} onClick={() => setReview(true)}>順位を確認する →</button>}
        </div>
      </fieldset>
      <p className="sr-only" role="status">{announcement}</p>
      <p role="status" aria-live="polite" className="adm-status mt-2" data-ok={state?.ok}>{state?.message ?? ""}</p>
    </form>
  );
}
