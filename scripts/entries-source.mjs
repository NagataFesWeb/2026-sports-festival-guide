// 個人CSVはローカルを優先し、クラウドのビルドでは非公開Storageから取得する。
export function storageConfig(env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const bucket = env.FESTIVAL_ENTRIES_BUCKET || "festival-private";
  const object = env.FESTIVAL_ENTRIES_OBJECT || "entries/2026.csv";
  const headers = { apikey: key, ...(!key.startsWith("sb_secret_") ? { Authorization: `Bearer ${key}` } : {}) };
  const objectPath = [bucket, ...object.split("/")].map(encodeURIComponent).join("/");
  return { url, bucket, object, objectPath, headers };
}

export async function readEntriesSource(localText, env, request = fetch) {
  if (localText !== null) return { text: localText, source: "ローカルCSV" };
  const config = storageConfig(env);
  if (!config) return { text: "学籍番号,出場競技\n", source: "CSVなし（空データ）" };
  // 認証情報・個人データを含み得るレスポンス本文をエラーに転記しない。
  let response;
  try {
    response = await request(`${config.url}/storage/v1/object/authenticated/${config.objectPath}`, {
      headers: config.headers, signal: AbortSignal.timeout(30_000), redirect: "error",
    });
  } catch {
    throw new Error("出場表Storageに接続できません。空データでは公開せず、ビルドを停止します");
  }
  if (!response.ok) throw new Error(`出場表Storage HTTP ${response.status}。npm run entries:upload と接続設定を確認してください`);
  const text = await response.text();
  if (text.split(/\r?\n/).filter(line => line.trim()).length < 2) throw new Error("出場表StorageのCSVが空です");
  return { text, source: "非公開Supabase Storage" };
}
