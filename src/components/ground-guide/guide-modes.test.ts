import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GroundOverview } from "./GroundOverview";
import { GroundGuide } from "./GroundGuide";

describe("全体案内と個人案内",()=>{
  it("全体案内には個人の入力・GPS・経路を出さず、両側の集合区分を出す",()=>{
    const html=renderToStaticMarkup(createElement(GroundOverview,{event:"swedish"}));
    expect(html).toContain("本部側・走前：2・6走");
    expect(html).toContain("バックストレート側・走前：1・3・4・5走");
    for(const text of ["現在地を取得","出発地点","自分の区分","学籍番号"])expect(html).not.toContain(text);
  });
  it("個人案内にも他の走順の集合区分を残し、自分の区分と経路を表示する",()=>{
    const html=renderToStaticMarkup(createElement(GroundGuide,{embedded:true,initialStudentId:"2806",initialEvent:"男女混合リレー1~6走",initialSlot:"第5走者"}));
    expect(html).toContain("本部側・走前：1・3・5・7・8走");
    expect(html).toContain("バックストレート側・走前：2・4・6走");
    expect(html).toContain("自分の区分");
    expect(html).toContain("2年8組の生徒席・テント");
    expect(html).not.toContain("現在地を取得");
    expect(html).not.toContain("GPS位置合わせ");
    expect(html).not.toContain("3Dモデル保存");
    expect(html.match(/<svg/g)).toHaveLength(1);
    expect(html).toContain("集合場所は走前");
  });
  it("競技の流れを開いたときだけアニメーションを表示する",()=>{
    const html=renderToStaticMarkup(createElement(GroundGuide,{embedded:true,initialStudentId:"2806",initialEvent:"男女混合リレー7〜8走",initialSlot:"第2走者",initialMode:"flow"}));
    expect(html).toContain("第8走者");
    expect(html).toContain("流れを再生");
    expect(html).not.toContain("集合場所まで");
    expect(html.match(/<svg/g)).toHaveLength(1);
    expect(html).toContain("自分：2年 8組 第8走者");
    expect(html).toContain("本部側・走前");
    expect(html).toContain("本部側・走後");
    expect(html).toContain("バックストレート側・走後");
  });
  it("走順が不明な個人案内で第1走者を推測しない",()=>{
    const html=renderToStaticMarkup(createElement(GroundGuide,{embedded:true,initialStudentId:"2806",initialEvent:"男女混合リレー"}));
    expect(html).toContain("自分の走順を選ぶ");
    expect(html).not.toContain("概略矢印");
    expect(html).not.toContain("第0走者");
  });
});
