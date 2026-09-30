/** Supabase Auth が招待・再設定リンクに載せるトークンだけを受け付ける。 */
export function setupTokenFromHash(hash: string): string | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const type = params.get("type");
  const token = params.get("access_token");
  if (!token || !type || !["invite", "recovery", "signup"].includes(type)) return null;
  return token;
}
