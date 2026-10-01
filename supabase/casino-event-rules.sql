-- 既存の受付設定を更新する。対象の旧ベット・結果がある場合は変更せず停止する。
begin;
lock table public.markets, public.bets, public.events, public.event_results in share row exclusive mode;
do $rules$
begin
  if exists (
    select 1 from public.markets m join public.events e on e.id = m.event_id
    where (e.formation = 'horse' or e.name like '%騎馬戦%')
      and m.options <> '[{"id":"red","num":"RED","name":"紅組"},{"id":"white","num":"WHITE","name":"白組"}]'::jsonb
      and (m.status = 'settled' or exists (select 1 from public.bets b where b.market_id = m.id)
        or exists (select 1 from public.event_results r where r.event_id = e.id))
  ) then raise exception '騎馬戦に旧ベットまたは確定結果があります。変更を停止しました'; end if;
  if exists (
    select 1 from public.bets b join public.markets m on m.id = b.market_id
    where m.type = 'event' and m.title !~* '(リレー|relay)' and b.kind <> 'win'
  ) then raise exception 'リレー以外に複勝・三連単の既存ベットがあります。変更を停止しました'; end if;

  update public.events set category = 'field'
    where name !~* '(リレー|relay)' and category = 'race';
  update public.markets set category = 'field'
    where type = 'event' and title !~* '(リレー|relay)' and category = 'race';
  update public.markets m set category = 'field',
    options = '[{"id":"red","num":"RED","name":"紅組"},{"id":"white","num":"WHITE","name":"白組"}]'::jsonb
    from public.events e where e.id = m.event_id and (e.formation = 'horse' or e.name like '%騎馬戦%')
      and m.options <> '[{"id":"red","num":"RED","name":"紅組"},{"id":"white","num":"WHITE","name":"白組"}]'::jsonb;
end;
$rules$;
commit;
