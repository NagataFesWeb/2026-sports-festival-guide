// 退場（DISCONNECT）。セッション Cookie を消すだけで、ベットとクレジットは保持する
import { endSession } from "@/lib/auth/session";
import type { EnterApiResponse } from "@/lib/casino/view";

export async function POST() {
  await endSession("casino");
  return Response.json({ ok: true } satisfies EnterApiResponse);
}
