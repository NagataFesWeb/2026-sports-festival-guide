// F4 RANK：純資産の順位。最終精算までは自分の順位だけを見せる（仕様書 機能9）
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { RankScreen } from "@/components/underground/RankScreen";
import { requireCasinoStudent } from "@/lib/auth/session";
import { getRankView } from "@/lib/casino/store";

export default async function CasinoRankPage() {
  await connection();
  const studentId = await requireCasinoStudent();
  const view = await getRankView(studentId, new Date());
  if (!view) redirect("/casino/enter");
  return <RankScreen view={view} />;
}
