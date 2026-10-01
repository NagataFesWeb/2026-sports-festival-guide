"use client";

// 種目フォームのヒート編集。行（ID・名前）の追加／削除と学年別プリセットだけを担う。
// 空行の切り捨てと既定値（総合 1 ヒート）の補完は service.ts の normalizeHeats が行う
import { useState } from "react";
import type { Heat } from "@/lib/festival/types";
import { GRADE_HEAT_PRESET } from "./labels";

const DEFAULT_ROW: Heat = { id: "all", label: "総合" };

export function HeatsEditor({ heats }: { heats: readonly Heat[] }) {
  const [rows, setRows] = useState<Heat[]>(() => (heats.length > 0 ? heats.map((h) => ({ ...h })) : [{ ...DEFAULT_ROW }]));

  function update(index: number, patch: Partial<Heat>): void {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  return (
    <div className="grid gap-2">
      <p className="adm-note">
        着順・Market はヒート単位で管理します。学年別レースは 3 行、総合で 1 つだけなら 1 行にします。
        結果を確定した後にヒートを消すと、その結果は集計から外れます。
      </p>

      {rows.map((row, i) => (
        <div key={i} className="flex flex-wrap items-end gap-2">
          <label className="adm-field basis-28">
            <span>ID {i + 1}</span>
            <input
              className="adm-input"
              type="text"
              name="heatId"
              value={row.id}
              placeholder="all"
              onChange={(e) => update(i, { id: e.target.value })}
            />
          </label>
          <label className="adm-field min-w-0 flex-1 basis-36">
            <span>表示名</span>
            <input
              className="adm-input"
              type="text"
              name="heatLabel"
              value={row.label}
              placeholder="総合"
              onChange={(e) => update(i, { label: e.target.value })}
            />
          </label>
          <button
            type="button"
            className="adm-btn"
            data-tone="ghost"
            data-size="sm"
            onClick={() => setRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, j) => j !== i)))}
            disabled={rows.length <= 1}
          >
            この行を削除
          </button>
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        <button type="button" className="adm-btn" data-size="sm" onClick={() => setRows((prev) => [...prev, { id: "", label: "" }])}>
          ヒートを追加
        </button>
        <button
          type="button"
          className="adm-btn"
          data-size="sm"
          data-tone="primary"
          onClick={() => setRows(GRADE_HEAT_PRESET.map((h) => ({ ...h })))}
        >
          学年別（1年・2年・3年）にする
        </button>
        <button type="button" className="adm-btn" data-size="sm" data-tone="ghost" onClick={() => setRows([{ ...DEFAULT_ROW }])}>
          総合 1 ヒートにする
        </button>
      </div>
    </div>
  );
}
