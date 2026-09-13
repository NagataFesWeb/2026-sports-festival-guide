// カジノ入場（機能5）。ここだけはセッション不要。既に入場済みでも起動と接続演出を表示してから競技一覧へ送る
import { EnterScreen } from "@/components/underground/EnterScreen";
import { readSession } from "@/lib/auth/session";
import { INITIAL_POINTS } from "@/lib/casino/store";

export default async function CasinoEnterPage() {
  const studentId = await readSession("casino");
  return <EnterScreen authenticated={Boolean(studentId)} initialPoints={INITIAL_POINTS} serverNow={new Date().toISOString()} />;
}

