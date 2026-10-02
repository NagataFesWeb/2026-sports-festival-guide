-- 学年未指定の未確定優勝ベットを返金し、学年別の3Marketへ移行する。
-- 既存利用者の返金について承認を得た運用時に実行する。再実行は二重返金しない。
begin;
lock table public.settings, public.events, public.markets, public.casino_accounts,
 public.bets, public.event_results, public.casino_receipts, public.casino_settlement_undo in share row exclusive mode;
do $$
declare source public.markets; target_count integer;
begin
 select * into source from public.markets where id='day-overall' and type='overall' and heat_id is null;
 if not found then
   select count(*) into target_count from public.markets where id in ('day-overall-g1','day-overall-g2','day-overall-g3') and type='overall';
   if target_count=3 then return; end if;
   raise exception 'Legacy overall market missing';
 end if;
 if source.status='settled' or source.result_order is not null
  or (select final_settled_at from public.settings where id=1) is not null
  or exists(select 1 from public.bets where market_id=source.id and payout_amount is not null)
  or exists(select 1 from public.casino_settlement_undo where market_id=source.id)
 then raise exception 'Cannot migrate a settled overall market'; end if;
 if exists(select 1 from public.markets where type='overall' and id<>source.id) then
  raise exception 'Other overall markets already exist'; end if;
 if exists(select 1 from public.bets b left join public.casino_accounts a on a.student_id=b.student_id where b.market_id=source.id and a.student_id is null) then
  raise exception 'Bet account missing'; end if;
 update public.casino_accounts a set points_balance=a.points_balance+r.amount
 from (select student_id,sum(amount) as amount from public.bets where market_id=source.id group by student_id) r
 where a.student_id=r.student_id;
 insert into public.markets(id,type,event_id,heat_id,category,no,title,en,options,deadline,status,result_order,trifecta_odds_default,trifecta_odds_overrides)
 select 'day-overall-g'||g,'overall',null,'g'||g,null,'*','体育祭 全体優勝 '||g||'年',
  'OVERALL WINNER GRADE '||g,source.options,'2026-10-02T12:00:00+09:00'::timestamptz,
  'open',null,336,'{}'::jsonb from generate_series(1,3) g;
 delete from public.bets where market_id=source.id;
 delete from public.markets where id=source.id;
 update public.settings set scores_published_at=null where id=1;
end $$;
commit;
select id,title,heat_id,status,deadline at time zone 'Asia/Tokyo' as deadline_jst from public.markets where type='overall' order by heat_id;
