// F2 CREDIT：借入れ（ADVANCE）・返済（REPAY）
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { CreditScreen } from "@/components/underground/CreditScreen";
import { requireCasinoStudent } from "@/lib/auth/session";
import { getCreditView } from "@/lib/casino/store";

export default async function CasinoCreditPage() {
  await connection();
  const studentId = await requireCasinoStudent();
  const view = await getCreditView(studentId, new Date());
  // セッションはあるが口座が無い（DB を作り直した等）ときは入場からやり直す
  if (!view) redirect("/casino/enter");
  return <CreditScreen initial={view} />;
}
