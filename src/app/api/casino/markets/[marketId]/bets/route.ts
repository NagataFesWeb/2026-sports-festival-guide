// ベット確定。残高の検証・減算はサーバー側（store → betting.ts）で行う
import type { NextRequest } from "next/server";
import { readSession } from "@/lib/auth/session";
import { fail, parseBetInput, readJson } from "@/lib/casino/http";
import { submitBet } from "@/lib/casino/store";
import type { ApiResponse } from "@/lib/casino/view";

export async function POST(req: NextRequest, ctx: RouteContext<"/api/casino/markets/[marketId]/bets">) {
  const studentId = await readSession("casino");
  if (!studentId) return fail("unauthorized");
  const { marketId } = await ctx.params;
  const input = parseBetInput(await readJson(req));
  if (!input) return fail("bad_request");

  const r = await submitBet(marketId, studentId, input, new Date());
  if (!r.ok) return fail(r.error);
  return Response.json({ ok: true, view: r.view } satisfies ApiResponse);
}
