-- Satellite cafés publish categories within a single café menu. Keep their
-- hours and prices on the dated offering, even when a recipe is shared.
alter table public.menu_offerings add column is_special boolean not null default false;

insert into public.cafes(id, source_key, name, source_url)
select md5('scu:cafe:' || slug)::uuid, slug, name,
  'https://scudining.cafebonappetit.com/cafe/' || slug || '/'
from (values ('the-sunstream-cafe','Sunstream Café'), ('fresh-bytes','Fresh Bytes'),
  ('cadence-cyber-cafe','Cadence Cyber Café'), ('side-bar-cafe','Side Bar Café')) as v(slug,name)
on conflict (source_key) do nothing;

alter function benson_private.ingest_catalog(text,date,jsonb,jsonb,timestamptz) rename to ingest_benson_catalog;

create function benson_private.ingest_catalog(cafe text, d date, items jsonb, parts jsonb, captured timestamptz default clock_timestamp())
returns integer language plpgsql set search_path=pg_catalog,benson_private as $$
declare
  venue public.cafes%rowtype;
  kitchen uuid; service uuid; version uuid;
  part jsonb; category jsonb; item jsonb; item_id text; period text;
  position integer := 0;
begin
  if cafe in ('marketplace-2','mission-bakery') then
    return ingest_benson_catalog(cafe,d,items,parts,captured);
  end if;
  if cafe not in ('the-sunstream-cafe','fresh-bytes','cadence-cyber-cafe','side-bar-cafe') then
    raise exception 'Unsupported cafe %', cafe;
  end if;
  if jsonb_typeof(items) is distinct from 'object' or jsonb_typeof(parts) is distinct from 'array' then
    raise exception 'Invalid menu publication for % on %', cafe, d;
  end if;
  perform pg_advisory_xact_lock(hashtext('benson catalog '||cafe),d-date '2000-01-01');
  select * into strict venue from public.cafes where source_key=cafe;
  insert into public.stations(cafe_id,source_key,name) values (venue.id,cafe,venue.name)
    on conflict (cafe_id,source_key) do update set name=excluded.name returning id into kitchen;
  update public.menu_offerings o set is_listed=false from public.menu_services s
    where s.id=o.menu_service_id and s.cafe_id=venue.id and s.service_date=d and o.is_listed;
  update public.menu_services set status='unpublished' where cafe_id=venue.id and service_date=d;

  for part in select jsonb_array_elements(parts) loop
    period:=case when part->>'label'='Open' then 'All Day'
                 when part->>'label'='Lunch Tapas Menu' then 'Lunch'
                 else part->>'label' end;
    service:=catalog_service(venue.id,d,jsonb_build_array(period,part->>'starttime',part->>'endtime'),captured);
    for category in select jsonb_array_elements(part->'stations') loop
      for item_id in select jsonb_array_elements_text(category->'items') loop
        item:=items->item_id;
        if nullif(item->>'label','') is null then raise exception 'Missing menu item %',item_id; end if;
        version:=catalog_food(item, venue.source_url||d||'/', captured);
        position:=position+1;
        insert into public.menu_offerings(cafe_id,menu_service_id,station_id,food_version_id,
          source_occurrence_key,menu_section,price,sort_order,last_seen_at,serving_options,menu_source_url,is_special)
        values(venue.id,service,kitchen,version,category->>'id'||':'||item_id,
          category->>'label',item_price(item->>'price'),position,captured,sizes(item),venue.source_url||d||'/',item->>'special' is not distinct from '1')
        on conflict(menu_service_id,source_occurrence_key) do update set
          food_version_id=excluded.food_version_id, menu_section=excluded.menu_section,
          price=excluded.price, sort_order=excluded.sort_order, last_seen_at=captured,
          serving_options=excluded.serving_options, is_special=excluded.is_special, is_listed=true;
      end loop;
    end loop;
  end loop;
  if position=0 and items<>'{}' then raise exception 'No dated placements for % on %',cafe,d; end if;
  return position;
end $$;
revoke all on function benson_private.ingest_catalog(text,date,jsonb,jsonb,timestamptz) from public, anon, authenticated;

-- A separate job leaves the Benson retry schedule intact.
select cron.schedule('campus-cafe-daily-menu','15 7-10 * * *',$job$
  select benson_private.sync_cafe(c.source_key,(now() at time zone c.timezone)::date)
  from public.cafes c
  where c.active and c.source_key in ('the-sunstream-cafe','fresh-bytes','cadence-cyber-cafe','side-bar-cafe')
    and extract(hour from now() at time zone c.timezone) between 0 and 2
    and not exists (select from public.sync_runs r where r.cafe_id=c.id
      and r.service_date=(now() at time zone c.timezone)::date and r.status='succeeded');
$job$);
