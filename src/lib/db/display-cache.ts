import type { Repository } from "./repository";

// 表示専用の短期キャッシュ。原子的保存・認証・残高は必ず元のRepositoryを使う。
let generation = 0;
interface CacheEntry { generation: number; expires: number; promise: Promise<unknown> }
const caches = new WeakMap<Repository, Map<string, CacheEntry>>();
const MAX_KEYS = 32;

export function invalidateDisplayCache(): void { generation++; }

async function cached<T>(repository: Repository, key: string, load: () => Promise<T>, ttl = 3000): Promise<T> {
  let cache = caches.get(repository);
  if (!cache) { cache = new Map(); caches.set(repository, cache); }
  const previous = cache.get(key);
  if (previous && previous.generation === generation && previous.expires > Date.now()) {
    return structuredClone(await previous.promise) as T;
  }
  // 書込み中に始まった取得や失敗した取得を、新しい世代で再利用しない。
  const entry: CacheEntry = { generation, expires: Infinity, promise: load() };
  cache.delete(key);
  while (cache.size >= MAX_KEYS) cache.delete(cache.keys().next().value!);
  cache.set(key, entry);
  try {
    const value = await entry.promise as T;
    entry.expires = Date.now() + ttl;
    return structuredClone(value);
  } catch (error) {
    if (cache.get(key) === entry) cache.delete(key);
    throw error;
  }
}

/** 全利用者共通の一覧だけを再利用。ユーザー別・受付判定用の読み取りには使わない。 */
export function displayReads(repository: Repository) {
  return {
    listMarkets: () => cached(repository, "markets", () => repository.listMarkets()),
    listEvents: () => cached(repository, "events", () => repository.listEvents()),
    listBets: () => cached(repository, "bets", () => repository.listBets()),
  };
}
