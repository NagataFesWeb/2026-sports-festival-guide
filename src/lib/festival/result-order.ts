// 順位入力は全組の並べ替えだけ。欠落した順位を推測して精算しない。
export function validateCompleteOrder(order: readonly string[], ids: readonly string[]): string | null {
  if (ids.length === 0) return "チームが登録されていません";
  const known = new Set(ids);
  if (!order.every(id => known.has(id))) return "着順に存在しないチームが含まれています";
  if (new Set(order).size !== order.length) return "同じチームを複数の順位に指定できません";
  if (order.length !== ids.length) return `1位から${ids.length}位まで、すべての組を並べてください`;
  return null;
}

/** 表示の初期順。旧データの重複・欠落は表示だけで補い、保存時には完全な順位を要求する。 */
export function initialOrder(ids: readonly string[], previous: readonly string[] = []): string[] {
  const known = new Set(ids);
  return [...new Set([...previous.filter(id => known.has(id)), ...ids])];
}

/** 移動した組以外の相対順序は保つ。 */
export function moveOrder(order: readonly string[], from: number, to: number): string[] {
  const next = [...order];
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= next.length || to >= next.length) return next;
  const [id] = next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}
