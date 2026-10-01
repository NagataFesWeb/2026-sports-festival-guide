import { describe, expect, it } from "vitest";
import { isValidUserId } from "./user-id";

describe("カジノのユーザーID", () => {
  it("半角英数字・ハイフン・アンダースコアの4〜32文字を許可する", () => {
    for (const id of ["abcd", "Nagata_79-test", "2117", "a".repeat(32)]) expect(isValidUserId(id)).toBe(true);
  });

  it("短すぎる・長すぎる・空白・全角・記号・制御文字を拒否する", () => {
    for (const id of ["", "abc", "a".repeat(33), " abcd", "abcd ", "ab cd", "ａｂｃｄ", "あいうえ", "abcd@example", "abcd\n"]) {
      expect(isValidUserId(id)).toBe(false);
    }
  });
});
