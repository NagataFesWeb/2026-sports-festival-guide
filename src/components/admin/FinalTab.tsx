// 最終精算タブ。実行すると全口座の 所持ポイント − 借金額 が確定し、以降の借入・返済が止まる
import Link from "next/link";
import { runFinalSettlementAction } from "@/app/admin/actions";
import { formatDateTime } from "@/lib/admin/datetime";
import type { SettlementPreview } from "@/lib/admin/service";
import { formatPoints } from "@/lib/casino/format";
import { ActionForm } from "./ActionForm";
import { ConfirmCheck } from "./ConfirmCheck";

export function FinalTab({ preview }: { preview: SettlementPreview }) {
  const settled = preview.finalSettledAt !== null;

  return (
    <section className="grid gap-4">
      <div className="adm-card" data-tone="dark">
        <div className="adm-label">FINAL SETTLEMENT</div>
        <p className="adm-note mt-1">
          全生徒の所持ポイントから借金額を引いて確定し、以降の借入れ・返済を停止します。<code>/ranking</code>{" "}
          が公開されます。取り消せません。
        </p>

        {settled ? (
          <div className="mt-3">
            <p className="text-om-yellow text-[13px] font-black">
              精算済み（{formatDateTime(preview.finalSettledAt)}）。借入・返済は停止しています。
            </p>
            <dl className="mt-2 grid gap-1 text-[12.5px]">
              <div className="flex gap-2">
                <dt className="font-black">口座数</dt>
                <dd className="adm-num">{preview.accounts}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-black">精算後の所持ポイント合計</dt>
                <dd className="adm-num">{formatPoints(preview.totalBalance)}pt</dd>
              </div>
            </dl>
            <p className="adm-note mt-2">
              最終順位は
              <Link className="mx-1 underline" href="/ranking">
                /ranking
              </Link>
              で公開されています。
            </p>
          </div>
        ) : (
          <div className="mt-3">
            <dl className="grid gap-1 text-[12.5px]">
              <div className="flex gap-2">
                <dt className="font-black">対象の口座数</dt>
                <dd className="adm-num">{preview.accounts}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-black">所持ポイント合計</dt>
                <dd className="adm-num">{formatPoints(preview.totalBalance)}pt</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-black">借金の合計</dt>
                <dd className="adm-num">{formatPoints(preview.totalDebt)}pt</dd>
              </div>
            </dl>
            <ActionForm action={runFinalSettlementAction} submitLabel="最終精算を実行する" tone="danger">
              <ConfirmCheck label="確認しました（全口座の借金を精算し、取り消せません）" />
            </ActionForm>
          </div>
        )}
      </div>

      <div className="adm-card">
        <h2 className="adm-title">得点・順位の公開は別の操作です</h2>
        <p className="adm-note">
          閉会式で表側に得点と順位を出すのは「得点」タブの「得点を公開する」です。最終精算はカジノのポイント精算だけを行います。
        </p>
      </div>
    </section>
  );
}
