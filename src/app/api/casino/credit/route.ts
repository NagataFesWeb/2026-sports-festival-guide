// 借入れ（ADVANCE）・返済（REPAY）。金額の検証と残高の増減はサーバー側（store → debt.ts）で行う
import type { NextRequest } from "next/server";
import { readSession } from "@/lib/auth/session";
import { fail, parseCreditInput, readJson, requestKey } from "@/lib/casino/http";
import { borrowPoints, repayPoints } from "@/lib/casino/store";
import type { CreditApiResponse } from "@/lib/casino/view";

export async function POST(req: NextRequest) {
  const studentId = await readSession("casino");
  if (!studentId) return fail("unauthorized");
  const input = parseCreditInput(await readJson(req));
  if (!input) return fail("bad_request");

  const key = requestKey(req, `credit:${studentId}:${input.action}`);
  if (key === null) return fail("bad_request");
  const r = input.action === "borrow" ? await borrowPoints(studentId, input.amount, key) : await repayPoints(studentId, input.amount, key);
  if (!r.ok) return fail(r.error);
  return Response.json({ ok: true, view: r.view } satisfies CreditApiResponse);
}
