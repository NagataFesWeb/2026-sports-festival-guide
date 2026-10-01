// カジノ入場（機能5）。口座作成（register）と入場（login）の両方をここで受ける
// ユーザーIDはここでしか受け取らず、以降は Cookie セッションから取る
import type { NextRequest } from "next/server";
import { startSession } from "@/lib/auth/session";
import { fail, parseEnterInput, readJson } from "@/lib/casino/http";
import { authenticateAccount, registerAccount } from "@/lib/casino/store";
import type { EnterApiResponse } from "@/lib/casino/view";

export async function POST(req: NextRequest) {
  const input = parseEnterInput(await readJson(req));
  if (!input) return fail("bad_request");

  if (input.mode === "register") {
    const created = await registerAccount(input.userId, input.password, input.nickname);
    if (!created.ok) return fail(created.error);
  } else {
    const authed = await authenticateAccount(input.userId, input.password);
    if (!authed.ok) return fail(authed.error);
  }

  // Cookie は Route Handler の中でのみ書ける
  await startSession("casino", input.userId);
  return Response.json({ ok: true } satisfies EnterApiResponse);
}
