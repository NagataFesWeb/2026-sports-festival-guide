// 賭け画面のデータ取得（ポーリング用）
import type { NextRequest } from "next/server";
import { readSession } from "@/lib/auth/session";
import { fail } from "@/lib/casino/http";
import { getMarketView } from "@/lib/casino/store";
import type { ApiResponse } from "@/lib/casino/view";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/casino/markets/[marketId]">) {
  const studentId = await readSession("casino");
  if (!studentId) return fail("unauthorized");
  const { marketId } = await ctx.params;
  const view = await getMarketView(marketId, studentId, new Date());
  if (!view) return fail("market_not_found");
  return Response.json({ ok: true, view } satisfies ApiResponse, { headers: { "Cache-Control": "no-store" } });
}
