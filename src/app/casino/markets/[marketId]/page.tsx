// 賭け画面
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { BetScreen } from "@/components/underground/bet/BetScreen";
import { requireCasinoStudent } from "@/lib/auth/session";
import { getMarketView } from "@/lib/casino/store";
import { getRepository } from "@/lib/db";

export default async function MarketPage({ params }: PageProps<"/casino/markets/[marketId]">) {
  await connection();
  const { marketId } = await params;
  const studentId = await requireCasinoStudent();
  const view = await getMarketView(marketId, studentId, new Date());
  if (!view) {
    // 口座が無いのは「セッションが古い」ケースなので入場からやり直す。Market が無いのは 404
    if (!(await getRepository().getAccount(studentId))) redirect("/casino/enter");
    notFound();
  }
  return <BetScreen initial={view} />;
}
