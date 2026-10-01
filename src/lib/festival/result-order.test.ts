import { describe, expect, it } from "vitest";
import { initialOrder, moveOrder, validateCompleteOrder } from "./result-order";
const ids = ["t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8"];
describe("全8組の並べ替え", () => {
  it("末尾から先頭と先頭から末尾へ移しても全組を保持する", () => {
    const next = moveOrder(ids, 7, 0);
    expect(next).toEqual(["t8", ...ids.slice(0, 7)]);
    expect(moveOrder(next, 0, 7)).toEqual(ids);
    expect(validateCompleteOrder(next, ids)).toBeNull();
    expect(ids[0]).toBe("t1");
  });
  it("表示の初期順で未知・重複を除き欠落を補う", () => {
    expect(initialOrder(ids, ["t3", "t3", "unknown", "t2"])).toEqual(["t3", "t2", "t1", "t4", "t5", "t6", "t7", "t8"]);
  });
  it("範囲外の移動と空の組一覧を許さない", () => {
    expect(moveOrder(ids, -1, 3)).toEqual(ids);
    expect(moveOrder(ids, 0, 8)).toEqual(ids);
    expect(validateCompleteOrder([], [])).not.toBeNull();
  });
});
