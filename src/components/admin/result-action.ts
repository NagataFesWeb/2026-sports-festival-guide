// 通信結果が不明でも順位を保持し、同じ順位で再試行できるようにする。
import type { ActionFn, ActionState } from "./action-state";

export async function runResultAction(action: ActionFn, previous: ActionState | null, data: FormData): Promise<ActionState> {
  try {
    return await action(previous, data);
  } catch (error) {
    // 認証切れによるNextの画面遷移は通常どおり処理する。
    if (error instanceof Error && "digest" in error && typeof error.digest === "string" && error.digest.startsWith("NEXT_REDIRECT")) throw error;
    return { ok: false, message: "保存結果を確認できませんでした。順位は保持しています。接続を確認し、同じ順位で再試行してください。" };
  }
}
