-- カジノの保存をまとめる。既存データを消さず、何度でも適用できる。
-- 三連単の高倍率や複利で32bit整数を超えても保存できる。
alter table public.casino_accounts alter column points_balance type bigint,
  alter column debt_amount type bigint, alter column final_balance_before type bigint,
  alter column final_debt type bigint;
alter table public.bets alter column amount type bigint, alter column payout_amount type bigint;
create table if not exists public.casino_receipts (
  request_key text primary key,
  created_at timestamptz not null default now()
);
alter table public.casino_receipts enable row level security;
grant all on table public.casino_receipts to service_role;

create or replace function public.commit_casino_mutation(change jsonb)
returns boolean
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  item jsonb;
  row_account public.casino_accounts;
  row_bet public.bets;
  row_market public.markets;
  row_result public.event_results;
begin
  -- service_role のサーバー専用。通常の管理更新とも同時に上書きしない。
  lock table public.settings, public.events, public.markets, public.casino_accounts,
    public.bets, public.event_results, public.casino_receipts in share row exclusive mode;
  if change->>'request_key' is not null and exists (
    select 1 from public.casino_receipts where request_key = change->>'request_key'
  ) then return true; end if;
  if change->>'accept_before' is not null and clock_timestamp() >= (change->>'accept_before')::timestamptz then return false; end if;
  if (select final_settled_at from public.settings where id = 1)
    is distinct from (change->>'expected_final_settled_at')::timestamptz then return false; end if;

  for item in select value from jsonb_array_elements(change->'expected_accounts') loop
    if not exists (select 1 from public.casino_accounts a
      where a is not distinct from jsonb_populate_record(null::public.casino_accounts, item)) then return false; end if;
  end loop;
  for item in select value from jsonb_array_elements(change->'expected_markets') loop
    if not exists (select 1 from public.markets m
      where m is not distinct from jsonb_populate_record(null::public.markets, item)) then return false; end if;
  end loop;
  for item in select value from jsonb_array_elements(change->'expected_events') loop
    if not exists (select 1 from public.events e
      where e is not distinct from jsonb_populate_record(null::public.events, item)) then return false; end if;
  end loop;
  for item in select value from jsonb_array_elements(change->'expected_bets') loop
    if not exists (select 1 from public.bets b
      where b is not distinct from jsonb_populate_record(null::public.bets, item)) then return false; end if;
  end loop;
  if (change->>'all_accounts')::boolean and (select count(*) from public.casino_accounts)
    <> jsonb_array_length(change->'expected_accounts') then return false; end if;
  if (change->>'all_markets')::boolean and (select count(*) from public.markets)
    <> jsonb_array_length(change->'expected_markets') then return false; end if;
  if change->>'bet_scope' is not null and (select count(*) from public.bets where market_id = change->>'bet_scope')
    <> jsonb_array_length(change->'expected_bets') then return false; end if;
  if change->>'delete_bet_id' is not null and not exists
    (select 1 from public.bets where id = change->>'delete_bet_id') then return false; end if;
  if change->>'insert_account' is not null and exists
    (select 1 from public.casino_accounts where student_id = change->'insert_account'->>'student_id') then return false; end if;
  if change->>'insert_bet' is not null and exists
    (select 1 from public.bets where id = change->'insert_bet'->>'id') then return false; end if;

  -- ここからの例外はRPC全体をロールバックする。配当だけ／残高だけは残さない。
  for item in select value from jsonb_array_elements(change->'accounts') loop
    row_account := jsonb_populate_record(null::public.casino_accounts, item);
    update public.casino_accounts set points_balance = row_account.points_balance,
      debt_amount = row_account.debt_amount, final_balance_before = row_account.final_balance_before,
      final_debt = row_account.final_debt where student_id = row_account.student_id;
    if not found then raise exception 'account not found'; end if;
  end loop;
  if change->>'insert_account' is not null then
    row_account := jsonb_populate_record(null::public.casino_accounts, change->'insert_account');
    insert into public.casino_accounts select row_account.*;
  end if;
  if change->>'insert_bet' is not null then
    row_bet := jsonb_populate_record(null::public.bets, change->'insert_bet');
    insert into public.bets select row_bet.*;
  end if;
  if change->>'delete_bet_id' is not null then
    delete from public.bets where id = change->>'delete_bet_id';
  end if;
  for item in select value from jsonb_array_elements(change->'payouts') loop
    update public.bets set payout_amount = (item->>'payout_amount')::bigint where id = item->>'id';
    if not found then raise exception 'bet not found'; end if;
  end loop;
  if change->>'market' is not null then
    row_market := jsonb_populate_record(null::public.markets, change->'market');
    update public.markets set status = row_market.status, result_order = row_market.result_order where id = row_market.id;
    if not found then raise exception 'market not found'; end if;
  end if;
  if change->>'event_result' is not null then
    row_result := jsonb_populate_record(null::public.event_results, change->'event_result');
    insert into public.event_results select row_result.* on conflict (event_id, heat_id)
      do update set "order" = excluded."order", points = excluded.points, confirmed_at = excluded.confirmed_at;
  end if;
  if change->>'final_settled_at' is not null then
    update public.settings set final_settled_at = (change->>'final_settled_at')::timestamptz where id = 1;
  end if;
  if change->>'request_key' is not null then
    insert into public.casino_receipts (request_key) values (change->>'request_key');
  end if;
  return true;
end;
$$;
revoke all on function public.commit_casino_mutation(jsonb) from public, anon, authenticated;
grant execute on function public.commit_casino_mutation(jsonb) to service_role;
