// 取り消せない操作の 2 段階目。window.confirm は使わず、チェックを必須にする（Server Action 側でも検証する）

export function ConfirmCheck({ label = "確認しました" }: { label?: string }) {
  return (
    <label className="adm-check">
      <input type="checkbox" name="confirm" />
      <span>{label}</span>
    </label>
  );
}
