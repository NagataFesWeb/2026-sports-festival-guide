// 競技一覧（賭け画面の前画面）
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { MarketListScreen } from "@/components/underground/MarketListScreen";
import { requireCasinoStudent } from "@/lib/auth/session";
import { getMarketList } from "@/lib/casino/store";

export default async function CasinoPage() {
  // 締切・プールはリクエストごとに変わるため動的に描画する
  await connection();
  const studentId = await requireCasinoStudent();
  const view = await getMarketList(studentId, new Date());
  // セッションはあるが口座が無い（DB を作り直した等）ときは入場からやり直す
  if (!view) redirect("/casino/enter");
  return <MarketListScreen view={view} />;
}
