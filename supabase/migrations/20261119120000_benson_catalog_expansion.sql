-- Keep private ingestion rules out of the client roles. Public options contain
-- only published menu information and the observed Transact selections.
create table benson_private.catalog_rules (
  name text primary key,
  value jsonb not null
);

alter table public.menu_offerings
  add column serving_options jsonb not null default '[]' check (jsonb_typeof(serving_options)='array'),
  add column modifier_groups jsonb not null default '[]' check (jsonb_typeof(modifier_groups)='array'),
  add column menu_source_url text;
alter table public.menu_services add column closure_message text;

create policy "Read catalog components" on public.menu_components
  for select to anon, authenticated using (true);
grant select on public.menu_components to anon, authenticated;

-- Give page-based clients a unique sort key without exposing the audit tables.
create view public.bites_catalog_component_links as
  select food_version_id::text || ':' || position || ':' || option_position as id,
    food_version_id, position, option_position, component_id, display_label, choice_group
  from public.food_version_components;
revoke all on public.bites_catalog_component_links from public, anon, authenticated;
grant select on public.bites_catalog_component_links to anon, authenticated;

insert into public.cafes(source_key,name,source_url)
values ('mission-bakery','Mission Bakery','https://scudining.cafebonappetit.com/cafe/mission-bakery/')
on conflict (source_key) do nothing;

create function benson_private.item_price(value text)
returns numeric language sql immutable as $$
  select case when btrim(value) ~ '^\$?[0-9]+(\.[0-9]{1,2})?$'
    then ltrim(btrim(value),'$')::numeric end
$$;

create function benson_private.placement_role(cafe text, item jsonb, station text, curated boolean)
returns text language sql immutable as $$
  select case
    when item->>'_namespace' is not null then 'standalone'
    when cafe='mission-bakery' then
      case when lower(item->>'sub_station')='milk' or lower(item->>'label') ~ '^add\M'
        then 'extra' else 'standalone' end
    when station='18700' then case when item->>'tier' in ('1','2') then 'standalone' else 'extra' end
    when station in ('25613','24741') then 'extra'
    when item->>'id' in ('24573842','24573843','24573844','24591843','30610444','35436959') then 'standalone'
    when item->>'id' in ('36220151','35476980') then 'extra'
    when station='26857' and item->>'sub_station'='Fresh Fruit' then 'extra'
    when station='18696' and lower(item->>'sub_station')='dispenser' then 'extra'
    else benson_private.item_role(item,station,curated)
  end
$$;

create function benson_private.option_section(cafe text, station text, item jsonb)
returns text language sql immutable as $$
  with fields as (select lower(coalesce(item->>'sub_station','')) as section,
    lower(item->>'label') as title)
  select case
    when cafe='mission-bakery' then case when section='milk' then 'Milk alternatives' else 'Drink add-ons' end
    when station='18700' then case section when 'base' then 'Base' when 'proteins' then 'Proteins'
      when 'toppings' then 'Toppings' when 'sauces' then 'Sauces' when 'seasonings' then 'Seasonings' else 'Add-ons' end
    when station='25613' then case when title='acai sorbet' then 'Base' else 'Toppings' end
    when station in ('24743','18695','24748','18722','18696','22584','18699','26857') then case
      when section ~ 'dressing|vinaigrette' then 'Dressings'
      when section ~ 'sugar & scoop|frozen yogurt|topping|sliced|pickled|scoop' then 'Toppings'
      when section ~ 'bread|tortilla|wrap|dough|crust' then
        case when station='18722' then 'Crust' else 'Bread and wraps' end
      when section ~ 'sauce|crema|spread|condiment|preserve|butter|salsa|syrup' then 'Sauces and spreads'
      when section ~ 'cheese' then 'Cheese'
      when section ~ 'meat|seafood|shrimp|protein' then 'Proteins'
      when section ~ 'vegetable' then 'Vegetables'
      when section ~ 'bean' then 'Beans'
      when section ~ 'grain' then 'Grains'
      when section='dispenser' then 'Fountain choices'
      when section ~ '^eggs?$' then 'Eggs'
      when section ~ 'fruit' then 'Fruit'
      else initcap(coalesce(nullif(section,''),'Options')) end
    else initcap(coalesce(nullif(section,''),'Options')) end from fields
$$;

-- The date-specific offering carries the options, since a station may publish
-- different ingredients at different services. A component's facts describe its
-- own published serving only.
create function benson_private.catalog_groups(cafe text, station text, target jsonb, items jsonb, ids jsonb, day date, url text)
returns jsonb language plpgsql set search_path=pg_catalog,benson_private as $$
declare
  raw jsonb; entry jsonb; source_item jsonb; serving jsonb; gid uuid; key text; label text;
  section text; options jsonb := '{}'; groups jsonb := '[]'; choice jsonb;
  name text := lower(target->>'label');
  tkey text := target->>'id';
begin
  if tkey='byo-pasta-full' then
    select value into raw from catalog_rules where catalog_rules.name='pasta-groups';
    for entry in select jsonb_array_elements(raw) loop
      options := '[]';
      for choice in select jsonb_array_elements(entry->'options') loop
        label:=choice->>0;
        key:='component:trattoria:'||trim(both '-' from regexp_replace(lower(label),'[^a-z0-9]+','-','g'));
        gid:=null;
        if label<>'No Sauce' then
          insert into public.menu_components(component_key,name) values(key,label)
          on conflict(component_key) do update set name=excluded.name returning id into gid;
        end if;
        options:=options || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
          'key',key,'label',label,'component_id',gid,'price',choice->1,
          'default',case when choice->>2='default' then true end,
          'observed_unavailable_on',case when choice->>2='observed-unavailable' then '2026-11-19' end)));
      end loop;
      groups:=groups || jsonb_build_array((entry-'options')||jsonb_build_object('options',options));
    end loop;
    return groups;
  end if;
  -- Published station choices are shown with their section, without inferring
  -- choice limits or asserting that every product accepts every option.
  if not (
    tkey in ('acai-bowl','poke-bowl','deli-sandwich','salad-bar','parrilla-builder','30610444')
    or cafe='mission-bakery' and target->>'_section'='Cold Drinks' and name !~ 'lemonade|italian soda'
    or station='18696' and name ~ 'burger|tuna melt|chicken sandwich'
    or station='18722' and (name ~ 'whole .*pizza|^whole cheese|pizza slice combo|ice cream|sorbet|sundae|banana split')
    or station='22584' and name ~ 'omelet|scramble|eggs your way|pancake|french toast'
    or station='18699' and name ~ 'breakfast.*burrito'
    or station='26857' and name ~ 'bagel|bread|soft-serve|yogurt|oatmeal|pancake|waffle'
  ) then return groups; end if;

  for source_item in
    select items->i from jsonb_array_elements_text(ids) i
    where placement_role(cafe,items->i,station,false)='extra'
  loop
    section:=option_section(cafe,station,source_item);
    if station='18696' and
      (tkey='30610444' and section<>'Fountain choices'
        or tkey<>'30610444' and section='Fountain choices' and name !~ 'combo') then continue; end if;
    if station='18722' and (
      (coalesce(source_item->>'sub_station','')='Sugar & Scoop') <>
      (name ~ 'ice cream|sorbet|sundae|banana split')
    ) then continue; end if;
    if station='22584' and (
      (source_item->>'id'='36220151') <> (name ~ 'pancake|french toast')
    ) then continue; end if;
    if station='26857' and (
      (name ~ 'soft-serve' and section not in ('Toppings','Sauces and spreads'))
      or (name ~ 'bagel|bread' and section not in ('Cheese','Sauces and spreads','Spread'))
      or (name ~ 'yogurt|oatmeal' and section not in ('Fruit','Toppings','Honey Granola','Maple Syrup'))
      or (name ~ 'pancake|waffle' and section not in ('Fruit','Maple Syrup','Sauces and spreads'))
    ) then continue; end if;
    label:=regexp_replace(btrim(source_item->>'label'),'[[:space:]]+',' ','g');
    if exists (select from jsonb_array_elements(coalesce(options->section,'[]')) o
      where lower(o->>'label')=lower(label)) then continue; end if;
    key:='component:benson:'||station||':'||(source_item->>'id');
    serving:=case when source_item#>>'{nutrition_details,servingSize,value}' is not null
      then jsonb_build_array(jsonb_build_object('kind','standalone','source',url,
        'item_id',source_item->>'id','nutrition',source_item->'nutrition_details')) else '[]' end;
    insert into public.menu_components(component_key,name,published_serving_candidates)
      values(key,label,serving) on conflict(component_key) do update
      set published_serving_candidates=case
        when excluded.published_serving_candidates='[]'
          or menu_components.published_serving_candidates @> excluded.published_serving_candidates
          then menu_components.published_serving_candidates
        else menu_components.published_serving_candidates||excluded.published_serving_candidates end
      returning id into gid;
    choice:=jsonb_strip_nulls(jsonb_build_object('key',key,'label',label,'component_id',gid,
        'price',case when section<>'Fountain choices' then item_price(source_item->>'price') end));
    options:=jsonb_set(options,array[section],coalesce(options->section,'[]')||jsonb_build_array(choice));
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object('name',g.key,'options',g.value)
    order by case g.key when 'Base' then 0 when 'Bread and wraps' then 0 when 'Crust' then 0
      when 'Proteins' then 1 when 'Toppings' then 2 when 'Sauces' then 3 when 'Add-ons' then 4 else 3 end,g.key),'[]')
    into groups from jsonb_each(options) g;
  return groups;
end $$;

create function benson_private.sizes(item jsonb)
returns jsonb language sql immutable as $$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'label',size->>'size','price',benson_private.item_price(size->>'price'),
    'portion',nullif(concat_ws(' ',nullif(size->>'portion',''),nullif(size->>'uom','')),''),
    'published_serving',case when size->>'portion' ~ '^[0-9]+(\.[0-9]+)?$'
      and item#>>'{nutrition_details,servingSize,value}' ~ '^[0-9]+(\.[0-9]+)?$'
      then round((size->>'portion')::numeric,scale((item#>>'{nutrition_details,servingSize,value}')::numeric))
        =(item#>>'{nutrition_details,servingSize,value}')::numeric
        and size->>'uom'=item#>>'{nutrition_details,servingSize,unit}' end))
    order by pos),'[]')
  from jsonb_array_elements(coalesce(item->'sizes','[]')) with ordinality s(size,pos)
  where nullif(size->>'size','') is not null
$$;

-- Last-mile service rules. A weekend component-only sushi publication does
-- not establish poke availability. Thanksgiving overrides came from the
-- Bon Appétit special-hours blocks for the respective cafes.
create function benson_private.catalog_window(cafe text, station text, d date, part jsonb)
returns jsonb language sql stable set search_path=pg_catalog,benson_private as $$
  with f as (select part->>'label' label, part->>'starttime' opens, part->>'endtime' closes,
    extract(isodow from d) in (6,7) weekend,
    (select value->cafe->d::text from catalog_rules where name='holiday') holiday)
  select case
    when cafe='marketplace-2' and d between date '2026-11-21' and date '2026-11-24'
      and station='18696' and label<>'All Day 11-9:00' then null
    when holiday is not null then
      case when holiday->station is not null then
        jsonb_build_array('All Day',holiday->station->>0,holiday->station->>1) end
    when cafe='mission-bakery' then jsonb_build_array('All Day',opens,closes)
    when station='25613' then jsonb_build_array('All Day',case when weekend then '10:00' else '08:00' end,'14:30')
    when station='18700' then jsonb_build_array('Lunch',case when weekend then opens else '10:30' end,'14:30')
    when station in ('24741','18695') and label='Lunch' then jsonb_build_array('Lunch',opens,'14:30')
    else jsonb_build_array(label,opens,closes) end from f
$$;

create function benson_private.catalog_placements(cafe text, d date, parts jsonb, items jsonb)
returns table(station_id text, station_name text, section text, hours jsonb, ids jsonb)
language sql stable set search_path=pg_catalog,benson_private as $$
  with source as (
    select part, st, st->>'label' title,
      case when cafe='mission-bakery' then 'mission-bakery' else st->>'id' end key
    from jsonb_array_elements(parts) part cross join lateral jsonb_array_elements(part->'stations') st
  ), placements as (
    select key,case when cafe='mission-bakery' then 'Mission Bakery' else title end venue,
      case when cafe='mission-bakery' then title end label,
      catalog_window(cafe,key,d,part) hours, entry.id, entry.pos
    from source cross join lateral jsonb_array_elements_text(st->'items') with ordinality entry(id,pos)
    where not (st->>'id'='18699' and part->>'label' not in ('Breakfast','Brunch')
      and placement_role(cafe,items->entry.id,st->>'id',false)='extra')
  ), distinct_items as (
    select distinct on (key,label,hours->>0,id) * from placements
    where hours is not null order by key,label,hours->>0,id,hours->>2,pos
  )
  select key,venue,label,hours,jsonb_agg(id order by pos,id)
   from distinct_items group by key,venue,label,hours
$$;

create function benson_private.catalog_service(c uuid, d date, hours jsonb, captured timestamptz)
returns uuid language sql set search_path=pg_catalog,benson_private as $$
  insert into public.menu_services(cafe_id,service_date,source_key,name,starts_at,ends_at,status,last_successful_sync_at,closure_message)
  values(c,d,concat_ws(':',hours->>0,hours->>1,hours->>2),hours->>0,
    (d+(hours->>1)::time) at time zone 'America/Los_Angeles',
    (d+(hours->>2)::time+case when (hours->>2)::time<=(hours->>1)::time
      then interval '1 day' else interval '0' end) at time zone 'America/Los_Angeles','published',captured,null)
  on conflict(cafe_id,service_date,source_key) do update
    set status='published',last_successful_sync_at=excluded.last_successful_sync_at,closure_message=null
  returning id
$$;

create function benson_private.catalog_food(item jsonb, url text, captured timestamptz)
returns uuid language plpgsql set search_path=pg_catalog,benson_private as $$
declare
  food uuid; ver uuid; facts jsonb; recipes text[]; tags text[]; allergens text[];
  title text := btrim(regexp_replace(item->>'label','^Value Meal[[:space:]]*-[[:space:]]*','','i'));
  itemid text := item->>'id';
  ns text := item->>'_namespace';
  fingerprint text;
begin
  if nullif(title,'') is null or itemid is null then raise exception 'Invalid menu item %',itemid; end if;
  select array(select r->>'recipe_id' from jsonb_array_elements(coalesce(item#>'{recipes,entrees}','[]')) r
    union all select r->>'recipe_id' from jsonb_array_elements(coalesce(item#>'{recipes,sides}','[]')) r) into recipes;
  if ns is null then
    select id into food from public.food_items
      where lower(name)=lower(title) and (
        source_namespace='scudining.cafebonappetit.com' and source_item_id=itemid
        or source_namespace='benson-menu' and source_item_id=itemid||':'||lower(title))
      order by source_namespace desc limit 1;
    if food is null and cardinality(recipes)>0 then
      select f.id into food from public.food_items f
      where f.source_namespace in ('scudining.cafebonappetit.com','benson-menu')
        and lower(f.name)=lower(title)
        and exists(select from public.food_versions v where v.food_item_id=f.id and v.source_recipe_ids=recipes)
      order by f.source_namespace desc,f.first_seen_at,f.id limit 1;
    end if;
  end if;
  if food is null then
    insert into public.food_items(source_namespace,source_item_id,name)
    values(coalesce(ns,'benson-menu'),case when ns is null then itemid||':'||lower(title) else itemid end,title)
    on conflict(source_namespace,source_item_id) do update set last_seen_at=captured returning id into food;
  else
    update public.food_items set last_seen_at=captured where id=food;
  end if;
  facts:=item->'nutrition_details';
  if jsonb_typeof(facts) is distinct from 'object' then facts:='{}'; end if;
  select coalesce(array_agg(distinct value order by value) filter(where key::int<250),'{}'),
    coalesce(array_agg(distinct value order by value) filter(where key::int>=250),'{}') into tags,allergens
    from jsonb_each_text(case when jsonb_typeof(item->'cor_icon')='object' then item->'cor_icon' else '{}' end);
  select id into ver from public.food_versions where food_item_id=food and published_nutrition=facts and source_recipe_ids=recipes
    and description is not distinct from nullif(item->>'description','') and ingredients_text is not distinct from nullif(item->>'ingredients','')
    and content_hash not like 'logged-configuration:%'
    and dietary_tags @> tags and tags @> dietary_tags and allergen_tags @> allergens and allergens @> allergen_tags
    order by captured_at,id limit 1;
  if ver is null then
    fingerprint:=md5(jsonb_build_array(title,item->'description',item->'ingredients',facts,recipes,tags,allergens)::text);
    insert into public.food_versions(food_item_id,content_hash,name,description,ingredients_text,source_recipe_ids,published_nutrition,
      dietary_tags,allergen_tags,allergen_information_available,serving_description,nutrition_source,source_url,
      calories_kcal,protein_g,carbohydrate_g,total_fat_g,saturated_fat_g,trans_fat_g,fiber_g,sugar_g,sodium_mg,cholesterol_mg)
    values(food,fingerprint,title,nullif(item->>'description',''),nullif(item->>'ingredients',''),recipes,facts,tags,allergens,
      cardinality(allergens)>0,coalesce(item->>'_serving',nullif(trim(concat_ws(' ',facts#>>'{servingSize,value}',facts#>>'{servingSize,unit}')),'')),
      case when facts='{}' then 'unavailable' else 'published' end,url,
      amount(facts,'calories',''),amount(facts,'proteinContent','g'),amount(facts,'carbohydrateContent','g'),amount(facts,'fatContent','g'),
      amount(facts,'saturatedFatContent','g'),amount(facts,'transFatContent','g'),amount(facts,'fiberContent','g'),amount(facts,'sugarContent','g'),
      amount(facts,'sodiumContent','mg'),amount(facts,'cholesterolContent','mg'))
    on conflict(food_item_id,content_hash) do nothing returning id into ver;
    if ver is null then
      select id into strict ver from public.food_versions where food_item_id=food and content_hash=fingerprint;
    end if;
  end if;
  return ver;
end $$;

create function benson_private.extra_dishes(cafe text, station text, section text, items jsonb, ids jsonb)
returns setof jsonb language sql stable set search_path=pg_catalog,benson_private as $$
  with app as (
    select v->>0 key,v->>1 title,v->>2 price,
      case when station='mission-bakery' then
        case when v->>0 in ('whole-fruit','fruit-cup-12oz') then 'Fruit & Fruit Cup' else 'Breakfast Grab & Go' end
        when v->>0='byo-pasta-half' then 'Value Menu' else 'Pasta and sides' end as shelf,
      case v->>0 when 'byo-pasta-full' then 'Full portion' when 'byo-pasta-half' then 'Half portion'
        when 'garlic-bread-1' then '1 piece' when 'hard-boiled-eggs-2' then '2 eggs' when 'fruit-cup-12oz' then '12 oz' end serving
    from catalog_rules r cross join lateral jsonb_array_elements(r.value) v
    where (station='24741' and r.name='trattoria')
       or (cafe='mission-bakery' and station='mission-bakery' and section='Pastries' and r.name='mission-bakery')
  ), builder(key,title,description,shelf) as (
    select * from (values
      ('acai-bowl','Açaí Bowl','Açaí sorbet with a selection of published toppings.','Build your bowl'),
      ('poke-bowl','Poke Bowl','Build your bowl with published bases, proteins, toppings and sauces.','Poke'),
      ('deli-sandwich','Build Your Own Deli Sandwich','Browse the published breads, fillings and spreads.','Deli builder'),
      ('salad-bar','Build Your Own Salad','Browse the published salad bar ingredients and dressings.','Salad bar'),
      ('parrilla-builder','La Parrilla Lunch & Dinner Builder','Browse the published tortillas, fillings and toppings.','La Parrilla builder')
    ) b(key,title,description,shelf)
    where (key='acai-bowl' and station='25613' and ids ? '33518147')
       or (key='poke-bowl' and station='18700' and exists(select from jsonb_array_elements_text(ids) i where items->i->>'sub_station'='base'))
       or (key='deli-sandwich' and station='18695' and exists(select from jsonb_array_elements_text(ids) i where items->i->>'sub_station'='bread'))
       or (key='salad-bar' and station='24748' and exists(select from jsonb_array_elements_text(ids) i where items->i->>'sub_station'='vegetables leafy'))
       or (key='parrilla-builder' and station='24743' and exists(select from jsonb_array_elements_text(ids) i where items->i->>'sub_station'='tortillas and flatbread'))
  )
  select jsonb_strip_nulls(jsonb_build_object('id',key,'label',title,'price',price,
    '_namespace','transact-benson','_section',shelf,'_serving',serving)) from app
  union all select jsonb_build_object('id',key,'label',title,'description',description,
    '_namespace','benson-builder','_section',shelf) from builder
$$;

create function benson_private.ingest_catalog(cafe text, d date, items jsonb, parts jsonb, captured timestamptz default clock_timestamp())
returns integer language plpgsql set search_path=pg_catalog,benson_private as $$
declare
  c uuid; service uuid; kitchen uuid; version uuid;
  placement record; item jsonb; itemid text; section text; title text; extras jsonb; role text;
  offers integer := 0; ordering integer; holiday jsonb; ids jsonb; all_items jsonb;
  url text := 'https://scudining.cafebonappetit.com/cafe/'||cafe||'/'||d||'/';
  public_source text; recurring record; offer_groups jsonb; offer_sizes jsonb;
begin
  if cafe not in ('marketplace-2','mission-bakery') then raise exception 'Unsupported cafe %',cafe; end if;
  select id into strict c from public.cafes where source_key=cafe;
  perform pg_advisory_xact_lock(hashtext('benson catalog '||cafe),d-date '2000-01-01');
  select value->cafe->d::text into holiday from catalog_rules where name='holiday';
  if holiday is distinct from '{}'::jsonb and
    (jsonb_typeof(items) is distinct from 'object' or items='{}' or jsonb_typeof(parts) is distinct from 'array') then
    raise exception 'No verified dated publication for % on %',cafe,d;
  end if;

  update public.menu_offerings o set is_listed=false from public.menu_services s
    where o.menu_service_id=s.id and s.cafe_id=c and s.service_date=d and o.is_listed;
  update public.menu_services set status='unpublished',station_extras='{}',closure_message=null
    where cafe_id=c and service_date=d and status<>'unpublished';
  if holiday='{}'::jsonb then
    insert into public.menu_services(cafe_id,service_date,source_key,name,status,last_successful_sync_at,closure_message)
    values (c,d,'holiday-closure','Thanksgiving break','closed',captured,'Closed for Thanksgiving break')
    on conflict(cafe_id,service_date,source_key) do update set status='closed',last_successful_sync_at=captured;
    return 0;
  end if;

  for placement in select * from catalog_placements(cafe,d,parts,items)
    order by station_id,section,hours
  loop
    service:=catalog_service(c,d,placement.hours,captured);
    insert into public.stations(cafe_id,source_key,name)
      values(c,placement.station_id,placement.station_name)
      on conflict(cafe_id,source_key) do update set name=excluded.name returning id into kitchen;
    ids:=placement.ids;
    all_items:=items;
    -- Recurrence is scoped to observed station, meal, day type and a verified
    -- open publication. Restricted service uses the actual holiday listing.
    if holiday is null then
      for recurring in
        select v->'item' item,v->>'source' source from catalog_rules r cross join lateral jsonb_array_elements(r.value) v
        where r.name='recurring' and v->>'station'=placement.station_id
          and v->>'period'=placement.hours->>0
          and (v->>'section') is not distinct from placement.section
          and (v->>'weekend')::boolean=(extract(isodow from d) in (6,7))
          and not exists(select from jsonb_array_elements_text(ids) live_id
            where lower(items->live_id->>'label')=lower(v#>>'{item,label}'))
      loop
        itemid:=recurring.item->>'id';
        if not (ids ? itemid) and (not all_items ? itemid or all_items->itemid->>'label'=recurring.item->>'label') then
          ids:=ids||to_jsonb(itemid);
          all_items:=jsonb_set(all_items,array[itemid],recurring.item||jsonb_build_object('_evidence',recurring.source));
        end if;
      end loop;
    end if;

    extras:='[]';
    ordering:=0;
    for item in
      select all_items->i from jsonb_array_elements_text(ids) with ordinality x(i,p) order by p
    loop
      itemid:=item->>'id';
      title:=btrim(regexp_replace(item->>'label','^Value Meal[[:space:]]*-[[:space:]]*','','i'));
      role:=placement_role(cafe,item,placement.station_id,exists(select from public.food_items
        where source_namespace='scudining.cafebonappetit.com' and source_item_id=itemid and lower(name)=lower(title)));
      if role='standalone' then continue; end if;
      -- Identical station details can appear in multiple dayparts or bakery sections.
      extras:=extras||jsonb_build_array(jsonb_build_object('source_id',itemid,'name',title,
        'section',case when role='notice' then 'Station notes' else option_section(cafe,placement.station_id,item) end));
    end loop;

    for item in
      select all_items->i from jsonb_array_elements_text(ids) x(i)
      union all select ext from extra_dishes(cafe,placement.station_id,placement.section,all_items,ids) ext
    loop
      ordering:=ordering+1;
      itemid:=item->>'id';
      title:=btrim(regexp_replace(item->>'label','^Value Meal[[:space:]]*-[[:space:]]*','','i'));
      role:=placement_role(cafe,item,placement.station_id,exists(select from public.food_items
        where source_namespace='scudining.cafebonappetit.com' and source_item_id=itemid and lower(name)=lower(title)));
      if role<>'standalone' then continue; end if;
      section:=coalesce(item->>'_section',placement.section,nullif(item->>'sub_station',''));
      if placement.section is not null then item:=item||jsonb_build_object('_section',section); end if;
      public_source:=coalesce(
        case when item->>'_namespace'='transact-benson' then
          'https://scudining.cafebonappetit.com/cafe/'||cafe||'/2026-11-19/' end,
        item->>'_evidence',url);
      version:=catalog_food(item,public_source,captured);
      offer_sizes:=sizes(item);
      -- Cold drink add-ons are published for the section. Do not carry those
      -- ingredients to other drink sections or dates.
      offer_groups:=catalog_groups(cafe,placement.station_id,item,all_items,ids,d,url);
      insert into public.menu_offerings(cafe_id,menu_service_id,station_id,food_version_id,source_occurrence_key,
        menu_section,price,sort_order,last_seen_at,serving_options,modifier_groups,menu_source_url)
      values(c,service,kitchen,version,placement.station_id||':'||itemid,
        section,item_price(item->>'price'),ordering,captured,offer_sizes,offer_groups,public_source)
      on conflict(menu_service_id,source_occurrence_key) do update set food_version_id=excluded.food_version_id,
        is_listed=true,price=excluded.price,sort_order=excluded.sort_order,menu_section=excluded.menu_section,
        last_seen_at=excluded.last_seen_at,serving_options=excluded.serving_options,modifier_groups=excluded.modifier_groups,
        menu_source_url=excluded.menu_source_url;
      offers:=offers+1;
    end loop;
    if extras<>'[]' then
      update public.menu_services set station_extras=jsonb_set(station_extras,array[kitchen::text],
        coalesce(station_extras->kitchen::text,'[]')||extras) where id=service;
    end if;
  end loop;
  if offers=0 then raise exception 'No verified offerings for % on %',cafe,d; end if;
  return offers;
end $$;

create function benson_private.sync_cafe(cafe text, d date)
returns text language plpgsql set search_path=pg_catalog,benson_private as $$
declare
  url text := 'https://scudining.cafebonappetit.com/cafe/'||cafe||'/'||d||'/';
  c uuid; run uuid; response benson_private.http_response; items jsonb; parts jsonb;
  seen int; holiday jsonb;
begin
  select id into strict c from public.cafes where source_key=cafe;
  if not pg_try_advisory_xact_lock(hashtext('benson catalog '||cafe),d-date '2000-01-01') then return 'already running'; end if;
  insert into public.sync_runs(cafe_id,service_date,source_url) values(c,d,url) returning id into run;
  begin
    select value->cafe->d::text into holiday from catalog_rules where name='holiday';
    if holiday is distinct from '{}'::jsonb then
      perform set_config('http.curlopt_timeout_ms','25000',true);
      select * into response from benson_private.http_get(url);
      if response.status <> 200 or position('site-panel__cafenav-days-trigger' in response.content)=0
        or (select array_agg(distinct m[1]) from regexp_matches(response.content,'data-end-date="([0-9-]+)"','g') m)
           is distinct from array[to_char(d,'YYYY-MM-DD')] then
        raise exception 'Unverified menu response (HTTP %)',response.status;
      end if;
      items := substring(response.content from $re$Bamco\.menu_items\s*=\s*([^\r\n]+);[ \t]*[\r\n]$re$)::jsonb;
      select jsonb_agg(m[1]::jsonb) into parts from regexp_matches(response.content,
        $re$Bamco\.dayparts\['[^']+'\]\s*=\s*([^\r\n]+);[ \t]*[\r\n]$re$,'g') m;
    end if;
    seen:=ingest_catalog(cafe,d,items,parts);
    update public.sync_runs set status='succeeded',completed_at=clock_timestamp(),
      raw_payload=jsonb_build_object('items',items,'dayparts',parts,'closed',seen=0,'catalog_expansion',true)
      where id=run;
    return 'published '||seen||' placements';
  exception when others then
    update public.sync_runs set status='failed',completed_at=clock_timestamp(),error_message=sqlerrm where id=run;
    return 'failed: '||sqlerrm;
  end;
end $$;

create or replace function benson_private.sync_menu(d date default (now() at time zone 'America/Los_Angeles')::date)
returns text language sql set search_path=pg_catalog,benson_private as $$
  select sync_cafe('marketplace-2',d)
$$;

-- Keep the existing job and UTC schedule. Each publication retries independently
-- within the existing local midnight window.
select cron.schedule('benson-daily-menu','0 7-10 * * *',$job$
  select benson_private.sync_cafe(c.source_key,(now() at time zone 'America/Los_Angeles')::date)
  from public.cafes c
  where c.source_key in ('marketplace-2','mission-bakery')
    and extract(hour from now() at time zone 'America/Los_Angeles') between 0 and 2
    and not exists (
      select from public.sync_runs r
      where r.cafe_id=c.id and r.service_date=(now() at time zone 'America/Los_Angeles')::date
        and r.status='succeeded' and r.raw_payload @> '{"catalog_expansion":true}'
    );
$job$);
