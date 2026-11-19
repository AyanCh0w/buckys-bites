create schema if not exists benson_private;
revoke all on schema benson_private from public, anon, authenticated;
create extension if not exists http with schema benson_private;
create extension if not exists pg_cron;

-- Items already outside the curated November 18 dish list (sides, toppings, etc.).
create table benson_private.baseline_exclusions (label text primary key);
insert into benson_private.baseline_exclusions values
('acai sorbet'),
('add-on bacon'),
('alfredo'),
('american cheese'),
('apple chicken sausage'),
('apricot preserves'),
('artichoke'),
('avocado'),
('avocado spread'),
('bacon'),
('balsamic vinaigrette'),
('balsamic vinegar'),
('banana'),
('banana split'),
('barley'),
('barq''s root beer'),
('basil'),
('basil parmesan pesto'),
('basil pesto'),
('beet'),
('bell pepper'),
('bell peppers'),
('beyond burger'),
('black beans'),
('black olives'),
('blackberries'),
('blanched broccoli'),
('blue cheese'),
('blueberries'),
('braised beef birria'),
('braised beef carnitas'),
('brioche bread'),
('broccoli'),
('brown rice'),
('brown sugar'),
('brownie sundae'),
('butter salted'),
('buttermilk pie with whipped cream & fresh fruit'),
('buttermilk ranch dressing'),
('caesar dressing'),
('cake cone'),
('cantaloupe'),
('caramel'),
('caramel sauce'),
('cheddar cheese'),
('cheddar jack'),
('cheerios'),
('cherry tomato'),
('chicken apple sausage'),
('chicken pollo asado'),
('chips and pico de gallo'),
('chocolate banana cream puff'),
('chocolate chips'),
('chocolate covered caramel apple'),
('chocolate ice cream'),
('chocolate lasagna'),
('chocolate reduced-fat soft-serve ice cream'),
('chocolate sprinkles'),
('chocolate syrup'),
('chorizo sausage'),
('ciabatta'),
('cilantro'),
('cinnamon raisin bread'),
('coke'),
('coke zero'),
('corn'),
('corn and rice pasta'),
('corn flakes'),
('corn tortilla'),
('cream cheese'),
('crispy wontons'),
('croutons'),
('cucumber'),
('dark chocolate sauce'),
('diced chicken'),
('diced chicken breast'),
('diced cucumber'),
('diced jalapeno'),
('diced pineapple'),
('diced tofu'),
('diced zucchini'),
('diet coke'),
('diet dr. pepper'),
('dijon mustard'),
('double beef patties'),
('dr. pepper'),
('dried cranberries'),
('dried cranberry'),
('egg'),
('egg white'),
('eggplant'),
('el sur empanada manzana'),
('everything bagel'),
('fanta orange'),
('fat free italian dressing'),
('feta cheese'),
('flour tortilla'),
('forsman ranch brown rice'),
('forsman ranch sushi rice'),
('fountain drink 16oz'),
('french fries'),
('fruit jelly'),
('fruit loops'),
('garbanzo beans'),
('garlic cream sauce'),
('ginger ale'),
('gingerbread latte mousse with biscoff cookie base'),
('gluten free crust'),
('goldfish crackers'),
('graham cracker crumbs'),
('green onion'),
('grilled bell pepper'),
('grilled chicken breast'),
('grilled onion'),
('grilled salmon fillet'),
('grilled shrimp'),
('grilled vegetables'),
('grilled/roasted shrimp'),
('guacamole'),
('half avocado'),
('ham'),
('hard boiled egg'),
('herbed cream cheese'),
('hi-c fruit punch'),
('hoagie roll'),
('holiday caramel apple'),
('honey mustard dressing'),
('honey oat granola'),
('honeydew'),
('house made waffle cone'),
('house-made pizza dough'),
('hummus'),
('ice cream cookie sandwich'),
('ice cream sundae'),
('iceberg lettuce'),
('imitation crab'),
('impossible plant-based meat'),
('italian sausage'),
('italian sausages'),
('kale'),
('ketchup'),
('key lime cloud pie'),
('kidney beans'),
('lettuce'),
('lettuce wrap'),
('lime wedges'),
('made without the top-9 food allergens plus gluten-containing ingredients'),
('mango'),
('mango sorbet'),
('maple syrup'),
('marinara sauce'),
('marshmallows'),
('mayonnaise'),
('mellow yello'),
('mini corn dogs'),
('mini m&ms'),
('mini marshmallows'),
('mint chocolate chip ice cream'),
('minute maid lemonade'),
('minute maid lemonade light'),
('mixed berries shortcake'),
('monterey jack cheese'),
('mozzarella'),
('mushroom'),
('mustard'),
('oatmeal'),
('oil olive'),
('olives'),
('onion'),
('oregano'),
('oreo cookie crumbles'),
('oreo cookies'),
('oreo crumbs'),
('pancake syrup'),
('parmesan cheese'),
('peas'),
('pecan''t pie'),
('penne pasta'),
('pepper jack cheese'),
('pepperoncini'),
('pepperoni'),
('philadelphia cream cheese'),
('pickle'),
('pickled jalapeno'),
('pickles'),
('pico de gallo'),
('pineapple'),
('pineapple chunk'),
('pinto beans'),
('plain bagel'),
('plant-based ham'),
('plant-based turkey'),
('pork carnitas'),
('portobello mushroom'),
('provolone cheese'),
('pumpkin seeds'),
('quinoa'),
('rainbow sprinkles'),
('raisin bran'),
('raspberries'),
('red cabbage and herb slaw'),
('red onion'),
('roasted cauliflower'),
('roasted potatoes'),
('roasted tomato salsa'),
('romaine lettuce'),
('salami'),
('salmon'),
('salsa'),
('salsa verde'),
('scrambled eggs'),
('seasoned ground beef'),
('sesame furikake'),
('sesame soy dressing'),
('sesame wakame salad'),
('shredded carrots'),
('shredded coconut'),
('shredded lettuce'),
('side of bacon (2)'),
('side of chicken apple sausage'),
('side of tater tots'),
('single beef patty'),
('sliced bell pepper'),
('sliced cucumber'),
('sliced mushroom'),
('sliced mushrooms'),
('sliced red onion'),
('sliced roast beef'),
('sliced scallion'),
('sliced tomato'),
('smoked turkey'),
('sour cream'),
('sourdough bread'),
('spanish style rice'),
('spinach'),
('spinach tortilla'),
('spring mix'),
('sprite'),
('sprite zero'),
('sriracha mayonnaise'),
('strawberries'),
('strawberry'),
('strawberry ice cream'),
('strawberry jelly preserves'),
('strawberry sauce'),
('strawberry yogurt'),
('sweet and spicy tamari ponzu'),
('sweet potato fries / curly fries'),
('swiss cheese'),
('tamari soy sauce'),
('tater tots'),
('thousand island dressing'),
('toasted coconut'),
('tofu'),
('tofu verde'),
('tomato'),
('tortilla strips'),
('tuna'),
('tuna salad'),
('turkey patty'),
('udi''s gluten-free white bread'),
('udi''s hamburger bun'),
('udi''s plain bagel'),
('udi''s white sandwich bread'),
('value meal- chips and guacamole'),
('value meal- garlic pizza sticks'),
('value meal- seasonal vegetable sticks with house made ranch'),
('vanilla ice cream'),
('vanilla reduced-fat soft-serve ice cream'),
('vanilla yogurt'),
('vegan cheese'),
('vegan eggs'),
('vegan ham'),
('vitamin water'),
('wasabi  mayonnaise'),
('wheat tortilla'),
('whipped cream'),
('white bread'),
('whole cracked egg'),
('whole wheat penne pasta'),
('whole-wheat bread'),
('zucchini');

create table benson_private.dish_review (
  food_item_id uuid primary key references public.food_items,
  name text not null,
  service_date date not null,
  station text not null,
  source_url text not null,
  alerted_at timestamptz
);

create function benson_private.amount(facts jsonb, field text, unit text) returns numeric
language sql immutable as $$
  select case when facts->field->>'value' ~ '^[0-9]+([.][0-9]+)?$'
    and facts->field->>'unit' = unit then (facts->field->>'value')::numeric end
$$;

create function benson_private.sync_menu(d date default (now() at time zone 'America/Los_Angeles')::date)
returns text language plpgsql set search_path = pg_catalog, benson_private as $$
declare
  url text := 'https://scudining.cafebonappetit.com/cafe/marketplace-2/' || to_char(d,'YYYY-MM-DD') || '/';
  c uuid; run uuid; response benson_private.http_response; items jsonb; parts jsonb; part jsonb; station jsonb;
  sid uuid; kitchen uuid; itemid text; item jsonb; food uuid; ver uuid; facts jsonb; recipes text[];
  tags text[]; allergens text[]; title text; idx int; seen int := 0; complete_time timestamptz := clock_timestamp();
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
    update public.menu_services set status='unpublished' where cafe_id=c and service_date=d;
    for part in select jsonb_array_elements(parts) loop
      start_time := d+(part->>'starttime')::time; end_time := d+(part->>'endtime')::time;
      if end_time<=start_time then end_time:=end_time+interval '1 day'; end if;
      insert into public.menu_services(cafe_id,service_date,source_key,name,starts_at,ends_at,status,last_successful_sync_at)
        values(c,d,concat_ws(':',part->>'label',part->>'starttime',part->>'endtime'),part->>'label',
          start_time at time zone 'America/Los_Angeles',end_time at time zone 'America/Los_Angeles','published',complete_time)
        on conflict(cafe_id,service_date,source_key) do update set status='published',last_successful_sync_at=excluded.last_successful_sync_at returning id into sid;
      for station in select jsonb_array_elements(part->'stations') loop
        idx:=0;
        for itemid in select jsonb_array_elements_text(station->'items') loop
          idx:=idx+1; item:=items->itemid; title:=trim(item->>'label');
          if nullif(title,'') is null then raise exception 'Invalid station item %',itemid; end if;
          select array(select r->>'recipe_id' from jsonb_array_elements(coalesce(item#>'{recipes,entrees}','[]')) r
            union all select r->>'recipe_id' from jsonb_array_elements(coalesce(item#>'{recipes,sides}','[]')) r) into recipes;
          select id into food from public.food_items where source_namespace='scudining.cafebonappetit.com' and source_item_id=itemid and lower(name)=lower(title);
          if food is null then
            select (array_agg(distinct f.id))[1] into food from public.food_items f join public.food_versions v on v.food_item_id=f.id
              where lower(f.name)=lower(title) and cardinality(recipes)>0 and v.source_recipe_ids=recipes having count(distinct f.id)=1;
          end if;
          if food is null then
            if exists(select from benson_private.baseline_exclusions where label=lower(title)) then continue; end if;
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
          insert into public.stations(cafe_id,source_key,name) values(c,station->>'id',station->>'label')
            on conflict(cafe_id,source_key) do update set name=excluded.name returning id into kitchen;
          insert into public.menu_offerings(cafe_id,menu_service_id,station_id,food_version_id,source_occurrence_key,menu_section,price,sort_order,last_seen_at)
            values(c,sid,kitchen,ver,(station->>'id')||':'||itemid,nullif(item->>'sub_station',''),
              case when item->>'price' ~ '^[0-9]+([.][0-9]{1,2})?$' then (item->>'price')::numeric end,idx,complete_time)
            on conflict(menu_service_id,source_occurrence_key) do update set food_version_id=excluded.food_version_id,is_listed=true,
              price=excluded.price,sort_order=excluded.sort_order,menu_section=excluded.menu_section,last_seen_at=excluded.last_seen_at;
          seen:=seen+1;
        end loop;
      end loop;
    end loop;
    if seen=0 then raise exception 'No dish placements verified'; end if;
    update public.sync_runs set status='succeeded',completed_at=clock_timestamp(),raw_payload=jsonb_build_object('items',items,'dayparts',parts) where id=run;
    return 'published '||seen||' placements';
  exception when others then
    update public.sync_runs set status='failed',completed_at=clock_timestamp(),error_message=sqlerrm where id=run;
    return 'failed: '||sqlerrm;
  end;
end $$;
