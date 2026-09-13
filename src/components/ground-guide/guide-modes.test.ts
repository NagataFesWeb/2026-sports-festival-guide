import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GroundOverview } from "./GroundOverview";
import { GroundGuide } from "./GroundGuide";

describe("全体案内と個人案内",()=>{
  it("全体案内には個人の入力・GPS・経路を出さず、両側の集合区分を出す",()=>{
    const html=renderToStaticMarkup(createElement(GroundOverview,{event:"swedish"}));
    expect(html).toContain("本部側：2・6走");
    expect(html).toContain("バックストレート側：1・3・4・5走");
    for(const text of ["現在地を取得","出発地点","自分の区分","学籍番号"])expect(html).not.toContain(text);
  });
  it("個人案内にも他の走順の集合区分を残し、自分の区分と経路を表示する",()=>{
    const html=renderToStaticMarkup(createElement(GroundGuide,{embedded:true,initialStudentId:"2806",initialEvent:"男女混合リレー1~6走",initialSlot:"第5走者"}));
    expect(html).toContain("本部側：1・3・5・7・8走");
    expect(html).toContain("バックストレート側：2・4・6走");
    expect(html).toContain("自分の区分");
    expect(html).toContain("2年8組の生徒席・テント");
    expect(html).toContain("現在地を取得");
  });
});
