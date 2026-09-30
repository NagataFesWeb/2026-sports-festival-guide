import { describe, expect, it } from "vitest";
import { formatFestivalDate } from "./format";

describe("formatFestivalDate", () => {
  it("UTC の時刻を日本の開催日で表示する", () => {
    expect(formatFestivalDate("2026-10-02T00:00:00+09:00")).toBe("2026. 10. 02 FRI");
  });

  it("開催日が未入力なら表示を保留する", () => {
    expect(formatFestivalDate(null)).toBeNull();
  });
});
