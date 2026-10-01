// Route Handler 共通：リクエストの検証とエラーレスポンス
import type { PlaceBetInput } from "./betting";
import type { ApiErrorCode, ApiResponse, EnterMode } from "./view";

const STATUS: Record<ApiErrorCode, number> = {
  bad_request: 400,
  invalid_kind: 422,
  invalid_selection: 422,
  invalid_stake: 422,
  insufficient_balance: 409,
  market_closed: 409,
  market_not_found: 404,
  bet_not_found: 404,
  account_not_found: 404,
  // 入場・セッション
  unauthorized: 401,
  invalid_user_id: 422,
  already_registered: 409,
  wrong_password: 401,
  invalid_password: 422,
  invalid_nickname: 422,
  // 借入れ・返済
  invalid_amount: 422,
  over_borrow_limit: 422,
  over_debt: 422,
  finalized: 409,
  // 同時更新（CAS の再試行が尽きた）
  conflict: 409,
};

export function fail(error: ApiErrorCode): Response {
  return Response.json({ ok: false, error } satisfies ApiResponse, { status: STATUS[error] });
}

/** JSON ボディを PlaceBetInput に変換する。金額の妥当性は betting.ts 側で判定する */
export function parseBetInput(body: unknown): PlaceBetInput | null {
  if (typeof body !== "object" || body === null) return null;
  const { kind, selection, amount } = body as Record<string, unknown>;
  if (kind !== "win" && kind !== "place" && kind !== "trifecta") return null;
  if (!Array.isArray(selection)) return null;
  const ids: string[] = [];
  for (const s of selection) {
    if (typeof s !== "string") return null;
    ids.push(s);
  }
  return { kind, selection: ids, amount };
}

export interface CreditInput {
  action: "borrow" | "repay";
  /** 金額の妥当性は debt.ts 側で判定するため unknown のまま渡す */
  amount: unknown;
}

/** F2 CREDIT のボディ（借入れ・返済） */
export function parseCreditInput(body: unknown): CreditInput | null {
  if (typeof body !== "object" || body === null) return null;
  const { action, amount } = body as Record<string, unknown>;
  if (action !== "borrow" && action !== "repay") return null;
  return { action, amount };
}

export interface EnterInput {
  userId: string;
  password: string;
  mode: EnterMode;
  /** 口座作成時のニックネーム。login では無視される。妥当性は nickname.ts 側で判定する */
  nickname: string;
}

/** 入場（/api/casino/enter）のボディ */
export function parseEnterInput(body: unknown): EnterInput | null {
  if (typeof body !== "object" || body === null) return null;
  const { userId, password, mode, nickname } = body as Record<string, unknown>;
  if (typeof userId !== "string" || typeof password !== "string") return null;
  if (mode !== "login" && mode !== "register") return null;
  const id = userId.trim();
  if (id.length === 0 || id.length > 32) return null;
  return { userId: id, password, mode, nickname: typeof nickname === "string" ? nickname : "" };
}

/** リクエストの JSON を読む（壊れていれば null） */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return (await req.json()) as unknown;
  } catch {
    return null;
  }
}

/** 再送識別子は認証済み口座・操作ごとに分離する。未指定の旧クライアントも許容する */
export function requestKey(req: Request, scope: string): string | undefined | null {
  const id = req.headers.get("Idempotency-Key");
  if (id === null) return undefined;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  return `${scope}:${id}`;
}
