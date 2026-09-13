// Server Action と useActionState の間で受け渡す共通の結果型（管理画面の全フォームで共有する）

export interface ActionState {
  ok: boolean;
  /** 画面の role="status" 領域に表示する文（成功・失敗どちらも入れる） */
  message: string;
}

/** useActionState に渡す Server Action の形。初期状態は null */
export type ActionFn = (prev: ActionState | null, formData: FormData) => Promise<ActionState>;
