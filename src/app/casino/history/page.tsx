// F3 HISTORY：自分のベット履歴（Market ごとの当落・収支）
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { HistoryScreen } from "@/components/underground/HistoryScreen";
import { requireCasinoStudent } from "@/lib/auth/session";
import { getHistoryView } from "@/lib/casino/store";

export default async function CasinoHistoryPage() {
  await connection();
  const studentId = await requireCasinoStudent();
  const view = await getHistoryView(studentId, new Date());
  if (!view) redirect("/casino/enter");
  return <HistoryScreen view={view} />;
}
