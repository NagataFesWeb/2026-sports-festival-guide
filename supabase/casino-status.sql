-- 接続確認と当日準備の状態だけを読み取る。個人データは返さない。
select current_database() as database,
  (select count(*) from public.teams) as teams,
  (select count(*) from public.events) as events,
  (select count(*) from public.markets) as markets,
  (select count(*) from public.casino_accounts) as accounts,
  (select count(*) from public.bets) as bets,
  to_regprocedure('public.commit_casino_mutation(jsonb)') is not null as atomic_rpc_ready,
  to_regclass('public.casino_receipts') is not null as receipts_ready,
  (select final_settled_at from public.settings where id = 1) as final_settled_at;
