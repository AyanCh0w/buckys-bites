alter table public.menu_services add column station_extras jsonb not null default '{}'::jsonb;

-- Classify a placement, since the same food can be a topping at one station
-- and a standalone serving at another.
create function benson_private.item_role(item jsonb, station_name text, curated boolean)
returns text language sql immutable as $$
  with fields as (select lower(trim(item->>'label')) label,
    lower(trim(coalesce(item->>'sub_station',''))) section)
  select case
    when label like 'made without the top-9 food allergens%' then 'notice'
    when label ~ '^(add[ -]?on\M|extra )' then 'extra'
    when section in ('dispenser','beverages','drinks','coffee','tea','juice') or label ~ '^fountain drink\M' then 'standalone'
    when section ~ 'topping|add[ -]?on' and section <> 'frozen yogurt and toppings' then 'extra'
    when curated or label ~ '^(value meal|side of)\M' then 'standalone'
    when section in ('sugar & scoop','frozen yogurt and toppings') then
      case when label ~ 'ice cream|sorbet|sundae|banana split|frozen yogurt|milkshake' then 'standalone' else 'extra' end
    when lower(station_name)='toast bar' and section in ('bagels','breakfast bread','bread','breads','fresh fruit','yogurt','cereal','oatmeal','pancakes','waffles') then 'standalone'
    when section in ('fries','entree','a la carte','rice bowl','combo','special','static') then 'standalone'
    when label ~ 'syrup|sprinkles|crumbs' then 'extra'
    when item->>'tier' in ('1','2') or section='' then 'standalone'
    when label ~ '\m(sandwich|burrito|quesabirria|burger combo|tenders w/ fries)\M' then 'standalone'
    else 'extra' end from fields
$$;

create or replace function benson_private.sync_menu(d date default (now() at time zone 'America/Los_Angeles')::date)
returns text language plpgsql set search_path = pg_catalog, benson_private as $$
declare
  url text := 'https://scudining.cafebonappetit.com/cafe/marketplace-2/' || to_char(d,'YYYY-MM-DD') || '/';
  c uuid; run uuid; response benson_private.http_response; items jsonb; parts jsonb; part jsonb; station jsonb;
  sid uuid; kitchen uuid; itemid text; item jsonb; food uuid; ver uuid; facts jsonb; recipes text[];
  tags text[]; allergens text[]; title text; idx int; seen int := 0; complete_time timestamptz := clock_timestamp();
  extras jsonb; role text;
  start_time timestamp; end_time timestamp; fingerprint text;
begin
  select id into strict c from public.cafes where source_key='marketplace-2';
  if not pg_try_advisory_xact_lock(hashtext('benson menu'),d-date '2000-01-01') then return 'already running'; end if;
  insert into public.sync_runs(cafe_id,service_date,source_url) values(c,d,url) returning id into run;
  begin
    perform set_config('http.curlopt_timeout_ms','25000',true);
    select * into response from benson_private.http_get(url);
    if response.status <> 200 or position('site-panel__cafenav-days-trigger' in response.content)=0
      or (select array_agg(distinct m[1]) from regexp_matches(response.content,'data-end-date="([0-9-]+)"','g') m)
         is distinct from array[to_char(d,'YYYY-MM-DD')] then raise exception 'Unverified menu response (HTTP %)',response.status; end if;
    items := substring(response.content from $re$Bamco\.menu_items\s*=\s*([^\r\n]+);[ \t]*[\r\n]$re$)::jsonb;
    select jsonb_agg(m[1]::jsonb) into parts from regexp_matches(response.content,
      $re$Bamco\.dayparts\['[^']+'\]\s*=\s*([^\r\n]+);[ \t]*[\r\n]$re$,'g') m;
    if jsonb_typeof(items) is distinct from 'object' or items='{}' or parts is null then raise exception 'No verifiable published menu'; end if;
    update public.menu_offerings o set is_listed=false from public.menu_services s
      where s.id=o.menu_service_id and s.cafe_id=c and s.service_date=d;
    update public.menu_services set status='unpublished',station_extras='{}' where cafe_id=c and service_date=d;
    for part in select jsonb_array_elements(parts) loop
      start_time := d+(part->>'starttime')::time; end_time := d+(part->>'endtime')::time;
      if end_time<=start_time then end_time:=end_time+interval '1 day'; end if;
      insert into public.menu_services(cafe_id,service_date,source_key,name,starts_at,ends_at,status,last_successful_sync_at)
        values(c,d,concat_ws(':',part->>'label',part->>'starttime',part->>'endtime'),part->>'label',
          start_time at time zone 'America/Los_Angeles',end_time at time zone 'America/Los_Angeles','published',complete_time)
        on conflict(cafe_id,service_date,source_key) do update set status='published',last_successful_sync_at=excluded.last_successful_sync_at returning id into sid;
      for station in select jsonb_array_elements(part->'stations') loop
          insert into public.stations(cafe_id,source_key,name) values(c,station->>'id',station->>'label')
            on conflict(cafe_id,source_key) do update set name=excluded.name returning id into kitchen;
        extras:='[]'::jsonb;
        idx:=0;
        for itemid in select jsonb_array_elements_text(station->'items') loop
          idx:=idx+1; item:=items->itemid; title:=trim(regexp_replace(item->>'label','^Value Meal[[:space:]]*-[[:space:]]*','','i'));
          if nullif(title,'') is null then raise exception 'Invalid station item %',itemid; end if;
          select array(select r->>'recipe_id' from jsonb_array_elements(coalesce(item#>'{recipes,entrees}','[]')) r
            union all select r->>'recipe_id' from jsonb_array_elements(coalesce(item#>'{recipes,sides}','[]')) r) into recipes;
          select id into food from public.food_items where source_namespace='scudining.cafebonappetit.com' and source_item_id=itemid and lower(name)=lower(title);
          if food is null then
            select (array_agg(distinct f.id))[1] into food from public.food_items f join public.food_versions v on v.food_item_id=f.id
              where lower(f.name)=lower(title) and cardinality(recipes)>0 and v.source_recipe_ids=recipes having count(distinct f.id)=1;
          end if;
          role:=benson_private.item_role(item,station->>'label',exists(select from public.food_items where id=food and source_namespace='scudining.cafebonappetit.com'));
          if role <> 'standalone' then
            extras:=extras || jsonb_build_array(jsonb_build_object('source_id',itemid,'name',title,
              'section',case when role='notice' then 'Station notes' else coalesce(nullif(item->>'sub_station',''),'Other options') end));
            continue;
          end if;
          if food is null then
            insert into public.food_items(source_namespace,source_item_id,name) values('benson-menu',itemid||':'||lower(title),title)
              on conflict(source_namespace,source_item_id) do update set last_seen_at=complete_time returning id into food;
            insert into benson_private.dish_review values(food,title,d,station->>'label',url,null) on conflict do nothing;
          end if;
          facts:=item->'nutrition_details'; if jsonb_typeof(facts) is distinct from 'object' then facts:='{}'; end if;
          select coalesce(array_agg(distinct value order by value) filter(where key::int<250),'{}'),
            coalesce(array_agg(distinct value order by value) filter(where key::int>=250),'{}') into tags,allergens
            from jsonb_each_text(case when jsonb_typeof(item->'cor_icon')='object' then item->'cor_icon' else '{}' end);
          select id into ver from public.food_versions where food_item_id=food and published_nutrition=facts and source_recipe_ids=recipes
            and description is not distinct from nullif(item->>'description','') and ingredients_text is not distinct from nullif(item->>'ingredients','')
            and dietary_tags=tags and allergen_tags=allergens order by captured_at limit 1;
          if ver is null then
            fingerprint:=md5(jsonb_build_array(title,item->'description',item->'ingredients',facts,recipes,tags,allergens)::text);
            insert into public.food_versions(food_item_id,content_hash,name,description,ingredients_text,source_recipe_ids,published_nutrition,
              dietary_tags,allergen_tags,allergen_information_available,serving_description,nutrition_source,source_url,
              calories_kcal,protein_g,carbohydrate_g,total_fat_g,saturated_fat_g,trans_fat_g,fiber_g,sugar_g,sodium_mg,cholesterol_mg)
              values(food,fingerprint,title,nullif(item->>'description',''),nullif(item->>'ingredients',''),recipes,facts,tags,allergens,
              cardinality(allergens)>0,nullif(trim(concat_ws(' ',facts#>>'{servingSize,value}',facts#>>'{servingSize,unit}')),''),
              case when facts='{}' then 'unavailable' else 'published' end,url,
              amount(facts,'calories',''),amount(facts,'proteinContent','g'),amount(facts,'carbohydrateContent','g'),amount(facts,'fatContent','g'),
              amount(facts,'saturatedFatContent','g'),amount(facts,'transFatContent','g'),amount(facts,'fiberContent','g'),amount(facts,'sugarContent','g'),
              amount(facts,'sodiumContent','mg'),amount(facts,'cholesterolContent','mg')) returning id into ver;
          end if;
          insert into public.menu_offerings(cafe_id,menu_service_id,station_id,food_version_id,source_occurrence_key,menu_section,price,sort_order,last_seen_at)
            values(c,sid,kitchen,ver,(station->>'id')||':'||itemid,nullif(item->>'sub_station',''),
              case when item->>'price' ~ '^[0-9]+([.][0-9]{1,2})?$' then (item->>'price')::numeric end,idx,complete_time)
            on conflict(menu_service_id,source_occurrence_key) do update set food_version_id=excluded.food_version_id,is_listed=true,
              price=excluded.price,sort_order=excluded.sort_order,menu_section=excluded.menu_section,last_seen_at=excluded.last_seen_at;
          seen:=seen+1;
        end loop;
        if jsonb_array_length(extras)>0 then
          update public.menu_services set station_extras=jsonb_set(station_extras,array[kitchen::text],extras) where id=sid;
        end if;
      end loop;
    end loop;
    if seen=0 and not exists(select from public.menu_services where cafe_id=c and service_date=d and station_extras<>'{}') then raise exception 'No dish placements verified'; end if;
    update public.sync_runs set status='succeeded',completed_at=clock_timestamp(),raw_payload=jsonb_build_object('items',items,'dayparts',parts) where id=run;
    return 'published '||seen||' placements';
  exception when others then
    update public.sync_runs set status='failed',completed_at=clock_timestamp(),error_message=sqlerrm where id=run;
    return 'failed: '||sqlerrm;
  end;
end $$;
