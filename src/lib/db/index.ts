// 永続化実装の選択。環境変数が揃っていれば Supabase、無ければ開発用のメモリ実装を使う
import { MemoryRepository } from "./memory";
import type { Repository } from "./repository";
import { SupabaseRepository } from "./supabase";

export type { Balances, BetFilter, Repository } from "./repository";

export type DbDriver = "supabase" | "memory";

/** 選択に使う環境変数（テストで差し替えられるよう process.env から切り離す） */
export interface DriverEnv {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  NODE_ENV?: string;
  /** next build のときは "phase-production-build"（ビルド中は DB に触らないので許可する） */
  NEXT_PHASE?: string;
  /** 本番でも意図してメモリ実装を使うときだけ "1"（データは再起動で消える） */
  ALLOW_MEMORY_DB?: string;
}

/**
 * どの実装で動くかを決める。
 * 本番（NODE_ENV=production）で Supabase が未設定なら、黙ってメモリ実装に落とさず例外にする。
 * Vercel ではサーバーレス関数ごとにメモリが分かれて再起動で消えるため、
 * 生徒のポイントやベットが失われる（仕様書 未決定事項「Vercel でのメモリ実装」）。
 */
export function selectDriver(env: DriverEnv): DbDriver {
  if (env.NEXT_PUBLIC_SUPABASE_URL && (env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY)) return "supabase";
  const isProduction = env.NODE_ENV === "production" && env.NEXT_PHASE !== "phase-production-build";
  if (isProduction && env.ALLOW_MEMORY_DB !== "1") {
    throw new Error(
      "Supabase が未設定です。本番では NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SECRET_KEY を環境変数に設定してください（メモリ実装で動かす場合は ALLOW_MEMORY_DB=1）",
    );
  }
  return "memory";
}

// 開発サーバーのホットリロードで作り直されないよう globalThis に保持する
const holder = globalThis as typeof globalThis & { __dbRepository?: Repository };

export function getRepository(): Repository {
  if (holder.__dbRepository) return holder.__dbRepository;

  const driver = selectDriver(process.env);
  const repository: Repository = driver === "supabase" ? new SupabaseRepository() : new MemoryRepository();
  // どの実装で動いているかは起動時に 1 度だけ出す
  console.info(`[db] driver = ${driver}`);
  holder.__dbRepository = repository;
  return repository;
}
