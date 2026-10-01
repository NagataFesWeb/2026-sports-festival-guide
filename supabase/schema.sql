-- ============================================================
-- 体育祭サイト（表 + 裏カジノ）のテーブル定義
--
-- 適用手順:
--   1. Supabase ダッシュボード → 対象プロジェクト → 左メニュー「SQL Editor」
--   2. 「New query」にこのファイルの内容を全文貼り付けて Run
--   3. 「Table Editor」で 9 テーブルができていること、
--      各テーブルの RLS が Enabled（ポリシー 0 件）であることを確認する
--
-- 何度実行しても壊れないよう create table if not exists で書いてある。
-- 列を変えたときは alter table を追記するか、開発中なら drop table してから再実行する。
--
-- アクセス制御:
--   全テーブルで RLS を有効にし、ポリシーは 1 つも作らない。
--   → anon / authenticated キーでは 1 行も読み書きできない。
--   → service role キー（サーバー側の Route Handler だけが持つ）は RLS をバイパスする。
--   生徒のポイント・借金をクライアントから直接触れないようにするための構成なので、
--   ここに anon 向けポリシーを足さないこと。
-- ============================================================

-- 生徒名簿（学籍番号が主キー。CSV で丸ごと入れ替える）
create table if not exists public.students (
  student_id text primary key,
  name       text not null,
  grade      int,  -- 1〜3。名簿 CSV に無ければ null
  class_no   int   -- 1〜8（チーム＝組）。名簿 CSV に無ければ null
);

-- 色別対抗チーム（全 8 チーム）
create table if not exists public.teams (
  id         text primary key,
  num        text not null,
  name       text not null,
  color      text not null,
  sort_order int  not null default 0
);

-- 種目（プログラム）
create table if not exists public.events (
  id             text primary key,
  no             text not null,
  name           text not null,
  en             text not null default '',
  kind           text not null default 'field'
                 check (kind in ('ceremony', 'track', 'field', 'club')),  -- マイページの絞り込みチップ
  category       text not null check (category in ('race', 'field')),
  start_time     timestamptz,
  delay_min      int   not null default 0,           -- 進行の遅延（＋）・前倒し（−）。分
  location       text  not null default '',
  entries        jsonb not null default '[]'::jsonb,  -- EventEntry[]（{slot, teamId}）
  rank_points    jsonb not null default '[]'::jsonb,  -- number[]（index 0 が 1 位の点数）
  heats          jsonb not null default '[]'::jsonb,  -- Heat[]（{id, label}）。最低 1 つ
  sort_order     int   not null default 0,
  participants   text  not null default '',           -- 対象タグ（"全員参加"・"クラス対抗" など）
  gather_start   text  not null default '',           -- 招集開始の目安（表示用文字列）
  gather_place   text  not null default '',
  belongings     text  not null default '',           -- 持ち物・服装
  formation      text  not null default 'none'
                 check (formation in ('grid', 'track', 'ball', 'parade', 'lane', 'rope', 'pole', 'horse', 'none')),
  formation_note text  not null default '',
  description    text  not null default ''            -- ルール・内容の要約
);

-- 種目のヒートごとの確定結果（"order" は SQL の予約語なので必ず二重引用符で囲む）
-- 主キーは (event_id, heat_id) の複合キー。PostgREST の upsert は ?on_conflict=event_id,heat_id が必要
create table if not exists public.event_results (
  event_id     text not null references public.events (id) on delete cascade,
  heat_id      text not null,
  "order"      jsonb not null default '[]'::jsonb,  -- string[]（先頭が 1 位の teamId）
  points       jsonb not null default '{}'::jsonb,  -- Record<teamId, 点数>
  confirmed_at timestamptz not null default now(),
  primary key (event_id, heat_id)
);

-- 招集案内（実行委員が CSV で丸ごと入れ替える）
create table if not exists public.invites (
  id          text primary key,
  student_id  text not null,
  event_name  text not null,
  gather_time text not null default '',
  location    text not null default '',
  tag         text not null default ''  -- 補足タグ（"ゼッケン着用" など）。無ければ空文字
);

create index if not exists invites_student_id_idx on public.invites (student_id);

-- ベットの対象（全体優勝 / 種目別 / custom の二択）
create table if not exists public.markets (
  id           text primary key,
  type         text not null check (type in ('overall', 'event', 'custom')),
  event_id     text references public.events (id) on delete set null,  -- type=event のみ
  heat_id      text,                                                   -- type=event のみ（学年別レースなど）
  category     text check (category in ('race', 'field')),             -- type=event のみ
  no           text not null,
  title        text not null,
  en           text not null default '',
  options      jsonb not null default '[]'::jsonb,  -- MarketOption[]（{id, num, name}）
  deadline     timestamptz not null,
  status       text not null check (status in ('open', 'closed', 'settled')),
  result_order jsonb,                               -- string[]。settled のときのみ
  trifecta_odds_default numeric(8,2) not null default 50.00 check (trifecta_odds_default between 1 and 1000),
  trifecta_odds_overrides jsonb not null default '{}'::jsonb
);

-- 既存プロジェクトにも再実行で追加する
alter table public.markets add column if not exists trifecta_odds_default numeric(8,2) not null default 50.00;
alter table public.markets add column if not exists trifecta_odds_overrides jsonb not null default '{}'::jsonb;

-- ベット（1 人が同じ Market に複数回賭けられる）
create table if not exists public.bets (
  id            text primary key,
  market_id     text not null references public.markets (id) on delete cascade,
  student_id    text not null,       -- カジノのユーザーID。既存列名を維持し、生徒名簿とは照合しない
  kind          text not null check (kind in ('win', 'place', 'trifecta')),
  selection     jsonb not null,      -- string[]（win/place は 1 件、trifecta は 3 件）
  amount        int   not null check (amount > 0),
  payout_amount int,                 -- 確定後に記録。外れは 0、未確定は null
  created_at    timestamptz not null default now()
);

create index if not exists bets_market_id_idx on public.bets (market_id);
create index if not exists bets_student_id_idx on public.bets (student_id);

-- カジノ口座（任意のユーザーIDが主キー。既存列名 student_id を維持。パスワードは scrypt ハッシュ）
create table if not exists public.casino_accounts (
  student_id           text primary key,
  password_hash        text not null,
  nickname             text not null default '',  -- 順位表示に使うニックネーム
  points_balance       int  not null default 1000,
  debt_amount          int  not null default 0 check (debt_amount >= 0),
  registered_at        timestamptz not null default now(),
  final_balance_before int,  -- 最終精算直前の所持ポイント。未精算なら null
  final_debt           int   -- 最終精算直前の借金額。未精算なら null
);

-- サイト全体の設定（1 行だけ。id は常に 1）
create table if not exists public.settings (
  id                  int primary key default 1 check (id = 1),
  final_settled_at    timestamptz,
  scores_published_at timestamptz  -- 得点・順位を表側に公開した時刻。null なら非公開
);

insert into public.settings (id, final_settled_at, scores_published_at)
values (1, null, null)
on conflict (id) do nothing;

-- 既存 DB 向け: casino_accounts に nickname 列を後から足す（何度実行しても壊れない）
alter table public.casino_accounts add column if not exists nickname text not null default '';

-- ============================================================
-- RLS: 全テーブルで有効化し、ポリシーは作らない（service role のみアクセス可）
-- ============================================================
alter table public.students        enable row level security;
alter table public.teams           enable row level security;
alter table public.events          enable row level security;
alter table public.event_results   enable row level security;
alter table public.invites         enable row level security;
alter table public.markets         enable row level security;
alter table public.bets            enable row level security;
alter table public.casino_accounts enable row level security;
alter table public.settings        enable row level security;


-- 当日の同時操作・再送を原子的に保存する（casino-atomic.sql と同期）
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


-- 検証用の取り消し記録。口座のパスワード・氏名は保存しない。
create table if not exists public.casino_settlement_undo (
  market_id text primary key references public.markets(id) on delete cascade,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.casino_settlement_undo enable row level security;
revoke all on public.casino_settlement_undo from anon, authenticated;
grant all on public.casino_settlement_undo to service_role;

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
  undo_snapshot jsonb;
begin
  -- service_role のサーバー専用。通常の管理更新とも同時に上書きしない。
  lock table public.settings, public.events, public.markets, public.casino_accounts,
    public.bets, public.event_results, public.casino_receipts, public.casino_settlement_undo in share row exclusive mode;
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

  if coalesce((change->>'record_settlement')::boolean, false) and change->>'market' is not null then
    undo_snapshot := jsonb_build_object(
      'market', (select to_jsonb(m) from public.markets m where id = change->'market'->>'id'),
      'accounts', coalesce((select jsonb_agg(to_jsonb(a)-'password_hash'-'nickname'-'registered_at' order by student_id)
        from public.casino_accounts a where student_id in (select value->>'student_id' from jsonb_array_elements(change->'accounts'))), '[]'::jsonb),
      'bets', coalesce((select jsonb_agg(to_jsonb(b) order by id) from public.bets b where market_id = change->'market'->>'id'), '[]'::jsonb),
      'result', (select to_jsonb(r) from public.event_results r where event_id = change->'market'->>'event_id' and heat_id = change->'market'->>'heat_id')
    );
  end if;

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
  if undo_snapshot is not null then
    undo_snapshot := undo_snapshot || jsonb_build_object(
      'after_market', (select to_jsonb(m) from public.markets m where id = change->'market'->>'id'),
      'after_accounts', coalesce((select jsonb_agg(to_jsonb(a)-'password_hash'-'nickname'-'registered_at' order by student_id)
        from public.casino_accounts a where student_id in (select value->>'student_id' from jsonb_array_elements(change->'accounts'))), '[]'::jsonb),
      'after_bets', coalesce((select jsonb_agg(to_jsonb(b) order by id) from public.bets b where market_id = change->'market'->>'id'), '[]'::jsonb),
      'after_result', (select to_jsonb(r) from public.event_results r where event_id = change->'market'->>'event_id' and heat_id = change->'market'->>'heat_id')
    );
    insert into public.casino_settlement_undo(market_id, snapshot) values (change->'market'->>'id', undo_snapshot)
      on conflict (market_id) do update set snapshot = excluded.snapshot, created_at = now();
  end if;
  return true;
end;
$$;
revoke all on function public.commit_casino_mutation(jsonb) from public, anon, authenticated;
grant execute on function public.commit_casino_mutation(jsonb) to service_role;

-- 記録後の金融状態が変わっていたら取り消さない。全復元は同じトランザクション。
create or replace function public.reset_market_settlement(target_id text)
returns text language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  undo_snapshot jsonb; current_market public.markets; item jsonb;
  row_account public.casino_accounts; row_bet public.bets; row_result public.event_results;
begin
  lock table public.settings, public.events, public.markets, public.casino_accounts,
    public.bets, public.event_results, public.casino_receipts, public.casino_settlement_undo in share row exclusive mode;
  if (select final_settled_at from public.settings where id = 1) is not null then return 'finalized'; end if;
  select * into current_market from public.markets where id = target_id;
  if not found or current_market.status <> 'settled' then return 'not_settled'; end if;
  select snapshot into undo_snapshot from public.casino_settlement_undo where market_id = target_id;
  if not found then return 'no_snapshot'; end if;
  if to_jsonb(current_market) is distinct from undo_snapshot->'after_market' then return 'changed'; end if;
  for item in select value from jsonb_array_elements(undo_snapshot->'after_accounts') loop
    if (select to_jsonb(a)-'password_hash'-'nickname'-'registered_at' from public.casino_accounts a where student_id = item->>'student_id')
      is distinct from item then return 'changed'; end if;
  end loop;
  if coalesce((select jsonb_agg(to_jsonb(b) order by id) from public.bets b where market_id = target_id), '[]'::jsonb)
    is distinct from undo_snapshot->'after_bets' then return 'changed'; end if;
  if coalesce((select to_jsonb(r) from public.event_results r where event_id = current_market.event_id and heat_id = current_market.heat_id), 'null'::jsonb)
    is distinct from undo_snapshot->'after_result' then return 'changed'; end if;
  for item in select value from jsonb_array_elements(undo_snapshot->'accounts') loop
    row_account := jsonb_populate_record(null::public.casino_accounts, item);
    update public.casino_accounts set points_balance = row_account.points_balance, debt_amount = row_account.debt_amount,
      final_balance_before = row_account.final_balance_before, final_debt = row_account.final_debt where student_id = row_account.student_id;
  end loop;
  for item in select value from jsonb_array_elements(undo_snapshot->'bets') loop
    row_bet := jsonb_populate_record(null::public.bets, item);
    update public.bets set payout_amount = row_bet.payout_amount where id = row_bet.id;
  end loop;
  update public.markets set status = undo_snapshot->'market'->>'status',
    result_order = case when undo_snapshot->'market'->>'result_order' is null then null else undo_snapshot->'market'->'result_order' end
    where id = target_id;
  -- 元が未確定の場合、SQL NULLを保持する。
  if undo_snapshot->'market'->>'result_order' is null then update public.markets set result_order = null where id = target_id; end if;
  delete from public.event_results where event_id = current_market.event_id and heat_id = current_market.heat_id;
  if undo_snapshot->>'result' is not null then
    row_result := jsonb_populate_record(null::public.event_results, undo_snapshot->'result');
    insert into public.event_results select row_result.*;
  end if;
  if current_market.type = 'overall' then update public.settings set scores_published_at = null where id = 1; end if;
  delete from public.casino_settlement_undo where market_id = target_id;
  return 'reset';
end;
$$;
revoke all on function public.reset_market_settlement(text) from public, anon, authenticated;
grant execute on function public.reset_market_settlement(text) to service_role;
