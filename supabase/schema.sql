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
  trifecta_odds_default numeric(8,2) not null default 336.00 check (trifecta_odds_default between 1 and 1000),
  trifecta_odds_overrides jsonb not null default '{}'::jsonb
);

-- 既存プロジェクトにも再実行で追加する
alter table public.markets add column if not exists trifecta_odds_default numeric(8,2) not null default 336.00;
alter table public.markets add column if not exists trifecta_odds_overrides jsonb not null default '{}'::jsonb;

-- ベット（1 人が同じ Market に複数回賭けられる）
create table if not exists public.bets (
  id            text primary key,
  market_id     text not null references public.markets (id) on delete cascade,
  student_id    text not null,
  kind          text not null check (kind in ('win', 'place', 'trifecta')),
  selection     jsonb not null,      -- string[]（win/place は 1 件、trifecta は 3 件）
  amount        int   not null check (amount > 0),
  payout_amount int,                 -- 確定後に記録。外れは 0、未確定は null
  created_at    timestamptz not null default now()
);

create index if not exists bets_market_id_idx on public.bets (market_id);
create index if not exists bets_student_id_idx on public.bets (student_id);

-- カジノ口座（学籍番号が主キー。パスワードは scrypt ハッシュ）
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
