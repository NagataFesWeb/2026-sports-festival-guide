// 自分のベットを1件取り消す（締切前のみ）
import type { NextRequest } from "next/server";
import { readSession } from "@/lib/auth/session";
import { fail } from "@/lib/casino/http";
import { withdrawBet } from "@/lib/casino/store";
import type { ApiResponse } from "@/lib/casino/view";

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/casino/bets/[betId]">) {
  const studentId = await readSession("casino");
  if (!studentId) return fail("unauthorized");
  const { betId } = await ctx.params;
  const r = await withdrawBet(betId, studentId, new Date());
  if (!r.ok) return fail(r.error);
  return Response.json({ ok: true, view: r.view } satisfies ApiResponse);
}
