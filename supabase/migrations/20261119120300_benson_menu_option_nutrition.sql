alter table public.food_versions
  add column incomplete_nutrients text[] not null default '{}';

-- Match ingredientNutrition in the app. Multiple publications of identical
-- quantities are fine, but conflicting standalone servings are ambiguous.
create function benson_private.menu_option_serving(p_component_id uuid)
returns jsonb language sql stable set search_path='' as $$
  with candidates as (
    select candidate->'nutrition' as facts
    from public.menu_components c
    cross join lateral jsonb_array_elements(c.published_serving_candidates) candidate
    where c.id=p_component_id and candidate->>'kind'='standalone'
      and nullif(candidate#>>'{nutrition,servingSize,value}','') is not null
  ), signatures as (
    select facts, (select jsonb_object_agg(key,jsonb_build_array(value->>'value',value->>'unit'))
      from jsonb_each(facts)) as signature
    from candidates
  )
  select (array_agg(facts))[1] from signatures
  having count(distinct signature)=1
$$;
revoke all on function benson_private.menu_option_serving(uuid) from public,anon,authenticated;

-- Store the computed serving as an immutable version so the ordinary log,
-- history and daily totals all read the same nutrition.
create or replace function public.bites_log_configured_food(
  p_offering_id uuid, p_servings numeric, p_meal text, p_eaten_at timestamptz,
  p_size text, p_choices text[]
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  base public.food_versions%rowtype;
  offer public.menu_offerings%rowtype;
  serving jsonb; option_group jsonb; option_value jsonb; selected jsonb:='[]';
  ids text[]:=coalesce(p_choices,'{}'); n integer; kept integer:=0;
  log_id uuid; version_id uuid; fingerprint text;
  builder boolean; replaces_drink boolean; unsupported_size boolean;
  removed_default boolean:=false; changed_recipe boolean:=false; is_default boolean;
  selected_extra boolean:=false; include_base boolean; missing_base boolean;
  component_facts jsonb; parts jsonb[]:='{}'; default_parts jsonb[]:='{}';
  totals jsonb; facts jsonb; incomplete text[]; serving_label text;
begin
  if auth.uid() is null then raise exception 'Sign in to save your food.'; end if;
  select * into strict offer from public.menu_offerings where id=p_offering_id;
  select * into strict base from public.food_versions where id=offer.food_version_id;
  if p_size is not null then
    select v into strict serving from jsonb_array_elements(offer.serving_options) v where v->>'label'=p_size;
  end if;
  unsupported_size:=p_size is not null and not coalesce((serving->>'published_serving')::boolean,false);
  builder:=regexp_replace(offer.source_occurrence_key,'^.*:','') in (
    'acai-bowl','poke-bowl','deli-sandwich','salad-bar','parrilla-builder','byo-pasta-full'
  );
  for option_group in select value from jsonb_array_elements(offer.modifier_groups) loop
    n:=0;
    for option_value in select value from jsonb_array_elements(option_group->'options') loop
      is_default:=coalesce((option_value->>'default')::boolean,false);
      if not coalesce(option_value->>'key'=any(ids),false) then
        removed_default:=removed_default or is_default;
        continue;
      end if;
      n:=n+1;
      kept:=kept+1;
      selected:=selected||jsonb_build_array(jsonb_build_object('group',option_group->>'name','label',option_value->>'label'));
      if not is_default then
        selected_extra:=true;
        changed_recipe:=changed_recipe or (
          option_group->>'name' not in ('Add-ons','Add-On','Drink add-ons','Toppings','Fruit','Breakfast')
          and option_value->>'label' !~* '^add-on '
        );
      end if;
      if option_value->>'key'='component:trattoria:no-sauce' then continue; end if;
      component_facts:=benson_private.menu_option_serving((option_value->>'component_id')::uuid);
      if is_default then
        default_parts:=array_append(default_parts,component_facts);
      else
        parts:=array_append(parts,component_facts);
      end if;
    end loop;
    if (option_group->>'min' is not null and n<(option_group->>'min')::int)
      or (option_group->>'max' is not null and n>(option_group->>'max')::int) then
      raise exception 'Choose a valid number of options for %.',option_group->>'name';
    end if;
  end loop;
  if kept<>cardinality(ids) then raise exception 'Choose options from this dish.'; end if;

  version_id:=base.id;
  if builder or removed_default or unsupported_size or selected_extra then
    replaces_drink:=jsonb_array_length(offer.modifier_groups)=1
      and offer.modifier_groups#>>'{0,name}'='Fountain choices' and kept=1;
    changed_recipe:=changed_recipe or removed_default or unsupported_size;
    include_base:=not builder and not replaces_drink and not changed_recipe;
    missing_base:=not builder and not replaces_drink and changed_recipe;
    if not include_base then parts:=parts||default_parts; end if;
    serving_label:=coalesce(p_size,case when include_base or builder then base.serving_description end);

    with fields(field,key,unit,label) as (values
      ('calories_kcal','calories','','Calories'),
      ('protein_g','proteinContent','g','Protein'),
      ('carbohydrate_g','carbohydrateContent','g','Total Carbohydrate'),
      ('total_fat_g','fatContent','g','Total Fat'),
      ('fiber_g','fiberContent','g','Dietary Fiber'),
      ('sugar_g','sugarContent','g','Sugars'),
      ('sodium_mg','sodiumContent','mg','Sodium'),
      ('saturated_fat_g','saturatedFatContent','g','Saturated Fat'),
      ('trans_fat_g','transFatContent','g','Trans Fat'),
      ('cholesterol_mg','cholesterolContent','mg','Cholesterol')
    ), combined as (
      select f.*, amounts.total,
        missing_base or coalesce(amounts.incomplete,false) as incomplete
      from fields f
      cross join lateral (
        select trim_scale(round(sum(amount),4)) as total, bool_or(amount is null) as incomplete
        from (
          select (to_jsonb(base)->>f.field)::numeric as amount where include_base
          union all
          select benson_private.amount(part,f.key,f.unit) from unnest(parts) part
        ) servings
      ) amounts
    )
    select coalesce(jsonb_object_agg(field,total) filter(where total is not null),'{}'),
      coalesce(jsonb_object_agg(key,jsonb_build_object('value',total::text,'unit',unit,'label',label))
        filter(where total is not null),'{}'),
      coalesce(array_agg(field order by field) filter(where combined.incomplete),'{}')
    into totals,facts,incomplete from combined;

    fingerprint:='logged-configuration:'||base.id::text||':'||
      md5(jsonb_build_array(serving_label,facts,incomplete)::text);
    insert into public.food_versions(
      food_item_id,content_hash,name,serving_description,nutrition_source,source_url,captured_at,
      published_nutrition,incomplete_nutrients,calories_kcal,protein_g,carbohydrate_g,total_fat_g,
      fiber_g,sugar_g,sodium_mg,saturated_fat_g,trans_fat_g,cholesterol_mg
    )
    values(
      base.food_item_id,fingerprint,base.name,serving_label,
      case when facts='{}' then 'unavailable' else 'estimated' end,
      base.source_url,base.captured_at,facts,incomplete,
      (totals->>'calories_kcal')::numeric,(totals->>'protein_g')::numeric,
      (totals->>'carbohydrate_g')::numeric,(totals->>'total_fat_g')::numeric,
      (totals->>'fiber_g')::numeric,(totals->>'sugar_g')::numeric,
      (totals->>'sodium_mg')::numeric,(totals->>'saturated_fat_g')::numeric,
      (totals->>'trans_fat_g')::numeric,(totals->>'cholesterol_mg')::numeric
    )
    on conflict(food_item_id,content_hash) do nothing;
    select id into strict version_id from public.food_versions
      where food_item_id=base.food_item_id and content_hash=fingerprint;
  end if;

  log_id:=public.bites_log_food(version_id,p_servings,p_meal,p_eaten_at);
  update public.food_logs set menu_selection=jsonb_strip_nulls(jsonb_build_object(
    'offering_id',p_offering_id,'size',p_size,'choices',selected)) where id=log_id;
  return log_id;
end $$;

-- These Transact choices match recipes published at Trattoria on Nov 19.
-- The serving amounts come from the station's publication.
insert into public.menu_components(component_key,name,published_serving_candidates) values
  ('component:trattoria:regular-penne', 'Regular Penne', $facts$[{"kind":"standalone","source":"https://scudining.cafebonappetit.com/cafe/marketplace-2/2026-11-19/","item_id":"14029435","nutrition":{"calories":{"label":"Calories","value":"240","unit":""},"servingSize":{"label":"Serving Size","value":"5.0","unit":"oz"},"fatContent":{"label":"Total Fat","value":"2","unit":"g"},"saturatedFatContent":{"label":"Saturated Fat","value":"0","unit":"g"},"transFatContent":{"label":"Trans Fat","value":"0","unit":"g"},"cholesterolContent":{"label":"Cholesterol","value":"0","unit":"mg"},"sodiumContent":{"label":"Sodium","value":"5","unit":"mg"},"carbohydrateContent":{"label":"Total Carbohydrate","value":"47","unit":"g"},"fiberContent":{"label":"Dietary Fiber","value":"2","unit":"g"},"sugarContent":{"label":"Sugars","value":"2","unit":"g"},"proteinContent":{"label":"Protein","value":"8","unit":"g"}}}]$facts$::jsonb),
  ('component:trattoria:whole-wheat-penne', 'Whole Wheat Penne', $facts$[{"kind":"standalone","source":"https://scudining.cafebonappetit.com/cafe/marketplace-2/2026-11-19/","item_id":"14029434","nutrition":{"calories":{"label":"Calories","value":"220","unit":""},"servingSize":{"label":"Serving Size","value":"5.0","unit":"oz"},"fatContent":{"label":"Total Fat","value":"2.5","unit":"g"},"saturatedFatContent":{"label":"Saturated Fat","value":"0","unit":"g"},"transFatContent":{"label":"Trans Fat","value":"0","unit":"g"},"cholesterolContent":{"label":"Cholesterol","value":"0","unit":"mg"},"sodiumContent":{"label":"Sodium","value":"10","unit":"mg"},"carbohydrateContent":{"label":"Total Carbohydrate","value":"43","unit":"g"},"fiberContent":{"label":"Dietary Fiber","value":"7","unit":"g"},"sugarContent":{"label":"Sugars","value":"1","unit":"g"},"proteinContent":{"label":"Protein","value":"8","unit":"g"}}}]$facts$::jsonb),
  ('component:trattoria:marinara-sauce', 'Marinara Sauce', $facts$[{"kind":"standalone","source":"https://scudining.cafebonappetit.com/cafe/marketplace-2/2026-11-19/","item_id":"14029436","nutrition":{"calories":{"label":"Calories","value":"60","unit":""},"servingSize":{"label":"Serving Size","value":"3.0","unit":"oz"},"fatContent":{"label":"Total Fat","value":"6","unit":"g"},"saturatedFatContent":{"label":"Saturated Fat","value":"1","unit":"g"},"transFatContent":{"label":"Trans Fat","value":"0","unit":"g"},"cholesterolContent":{"label":"Cholesterol","value":"0","unit":"mg"},"sodiumContent":{"label":"Sodium","value":"270","unit":"mg"},"carbohydrateContent":{"label":"Total Carbohydrate","value":"4","unit":"g"},"fiberContent":{"label":"Dietary Fiber","value":"2","unit":"g"},"sugarContent":{"label":"Sugars","value":"2","unit":"g"},"proteinContent":{"label":"Protein","value":"< 1","unit":"g"}}}]$facts$::jsonb),
  ('component:trattoria:alfredo-sauce', 'Alfredo Sauce', $facts$[{"kind":"standalone","source":"https://scudining.cafebonappetit.com/cafe/marketplace-2/2026-11-19/","item_id":"14029437","nutrition":{"calories":{"label":"Calories","value":"290","unit":""},"servingSize":{"label":"Serving Size","value":"3.0","unit":"oz"},"fatContent":{"label":"Total Fat","value":"30","unit":"g"},"saturatedFatContent":{"label":"Saturated Fat","value":"19","unit":"g"},"transFatContent":{"label":"Trans Fat","value":"2","unit":"g"},"cholesterolContent":{"label":"Cholesterol","value":"95","unit":"mg"},"sodiumContent":{"label":"Sodium","value":"135","unit":"mg"},"carbohydrateContent":{"label":"Total Carbohydrate","value":"4","unit":"g"},"fiberContent":{"label":"Dietary Fiber","value":"0","unit":"g"},"sugarContent":{"label":"Sugars","value":"2","unit":"g"},"proteinContent":{"label":"Protein","value":"3","unit":"g"}}}]$facts$::jsonb),
  ('component:trattoria:broccoli', 'Broccoli', $facts$[{"kind":"standalone","source":"https://scudining.cafebonappetit.com/cafe/marketplace-2/2026-11-19/","item_id":"14115262","nutrition":{"calories":{"label":"Calories","value":"10","unit":""},"servingSize":{"label":"Serving Size","value":"1.0","unit":"oz"},"fatContent":{"label":"Total Fat","value":"0","unit":"g"},"saturatedFatContent":{"label":"Saturated Fat","value":"0","unit":"g"},"transFatContent":{"label":"Trans Fat","value":"0","unit":"g"},"cholesterolContent":{"label":"Cholesterol","value":"0","unit":"mg"},"sodiumContent":{"label":"Sodium","value":"10","unit":"mg"},"carbohydrateContent":{"label":"Total Carbohydrate","value":"2","unit":"g"},"fiberContent":{"label":"Dietary Fiber","value":"< 1","unit":"g"},"sugarContent":{"label":"Sugars","value":"0","unit":"g"},"proteinContent":{"label":"Protein","value":"< 1","unit":"g"}}}]$facts$::jsonb),
  ('component:trattoria:tofu', 'Tofu', $facts$[{"kind":"standalone","source":"https://scudining.cafebonappetit.com/cafe/marketplace-2/2026-11-19/","item_id":"19608365","nutrition":{"calories":{"label":"Calories","value":"50","unit":""},"servingSize":{"label":"Serving Size","value":"2.0","unit":"oz"},"fatContent":{"label":"Total Fat","value":"3","unit":"g"},"saturatedFatContent":{"label":"Saturated Fat","value":"0","unit":"g"},"transFatContent":{"label":"Trans Fat","value":"0","unit":"g"},"cholesterolContent":{"label":"Cholesterol","value":"0","unit":"mg"},"sodiumContent":{"label":"Sodium","value":"5","unit":"mg"},"carbohydrateContent":{"label":"Total Carbohydrate","value":"1","unit":"g"},"fiberContent":{"label":"Dietary Fiber","value":"1","unit":"g"},"sugarContent":{"label":"Sugars","value":"0","unit":"g"},"proteinContent":{"label":"Protein","value":"5","unit":"g"}}}]$facts$::jsonb),
  ('component:trattoria:olives', 'Olives', $facts$[{"kind":"standalone","source":"https://scudining.cafebonappetit.com/cafe/marketplace-2/2026-11-19/","item_id":"32893502","nutrition":{"calories":{"label":"Calories","value":"40","unit":""},"servingSize":{"label":"Serving Size","value":"1.0","unit":"oz"},"fatContent":{"label":"Total Fat","value":"4.5","unit":"g"},"saturatedFatContent":{"label":"Saturated Fat","value":"0.5","unit":"g"},"transFatContent":{"label":"Trans Fat","value":"0","unit":"g"},"cholesterolContent":{"label":"Cholesterol","value":"0","unit":"mg"},"sodiumContent":{"label":"Sodium","value":"440","unit":"mg"},"carbohydrateContent":{"label":"Total Carbohydrate","value":"1","unit":"g"},"fiberContent":{"label":"Dietary Fiber","value":"< 1","unit":"g"},"sugarContent":{"label":"Sugars","value":"0","unit":"g"},"proteinContent":{"label":"Protein","value":"0","unit":"g"}}}]$facts$::jsonb),
  ('component:trattoria:spinach', 'Spinach', $facts$[{"kind":"standalone","source":"https://scudining.cafebonappetit.com/cafe/marketplace-2/2026-11-19/","item_id":"23021896","nutrition":{"calories":{"label":"Calories","value":"5","unit":""},"servingSize":{"label":"Serving Size","value":"1.0","unit":"oz"},"fatContent":{"label":"Total Fat","value":"0","unit":"g"},"saturatedFatContent":{"label":"Saturated Fat","value":"0","unit":"g"},"transFatContent":{"label":"Trans Fat","value":"0","unit":"g"},"cholesterolContent":{"label":"Cholesterol","value":"0","unit":"mg"},"sodiumContent":{"label":"Sodium","value":"20","unit":"mg"},"carbohydrateContent":{"label":"Total Carbohydrate","value":"1","unit":"g"},"fiberContent":{"label":"Dietary Fiber","value":"< 1","unit":"g"},"sugarContent":{"label":"Sugars","value":"0","unit":"g"},"proteinContent":{"label":"Protein","value":"< 1","unit":"g"}}}]$facts$::jsonb),
  ('component:trattoria:zucchini', 'Zucchini', $facts$[{"kind":"standalone","source":"https://scudining.cafebonappetit.com/cafe/marketplace-2/2026-11-19/","item_id":"14115260","nutrition":{"calories":{"label":"Calories","value":"5","unit":""},"servingSize":{"label":"Serving Size","value":"1.0","unit":"oz"},"fatContent":{"label":"Total Fat","value":"0","unit":"g"},"saturatedFatContent":{"label":"Saturated Fat","value":"0","unit":"g"},"transFatContent":{"label":"Trans Fat","value":"0","unit":"g"},"cholesterolContent":{"label":"Cholesterol","value":"0","unit":"mg"},"sodiumContent":{"label":"Sodium","value":"0","unit":"mg"},"carbohydrateContent":{"label":"Total Carbohydrate","value":"1","unit":"g"},"fiberContent":{"label":"Dietary Fiber","value":"0","unit":"g"},"sugarContent":{"label":"Sugars","value":"< 1","unit":"g"},"proteinContent":{"label":"Protein","value":"0","unit":"g"}}}]$facts$::jsonb),
  ('component:trattoria:mushroom', 'Mushroom', $facts$[{"kind":"standalone","source":"https://scudining.cafebonappetit.com/cafe/marketplace-2/2026-11-19/","item_id":"14115261","nutrition":{"calories":{"label":"Calories","value":"5","unit":""},"servingSize":{"label":"Serving Size","value":"1.0","unit":"oz"},"fatContent":{"label":"Total Fat","value":"0","unit":"g"},"saturatedFatContent":{"label":"Saturated Fat","value":"0","unit":"g"},"transFatContent":{"label":"Trans Fat","value":"0","unit":"g"},"cholesterolContent":{"label":"Cholesterol","value":"0","unit":"mg"},"sodiumContent":{"label":"Sodium","value":"0","unit":"mg"},"carbohydrateContent":{"label":"Total Carbohydrate","value":"1","unit":"g"},"fiberContent":{"label":"Dietary Fiber","value":"0","unit":"g"},"sugarContent":{"label":"Sugars","value":"0","unit":"g"},"proteinContent":{"label":"Protein","value":"< 1","unit":"g"}}}]$facts$::jsonb),
  ('component:trattoria:italian-sausage', 'Italian Sausage', $facts$[{"kind":"standalone","source":"https://scudining.cafebonappetit.com/cafe/marketplace-2/2026-11-19/","item_id":"19608364","nutrition":{"calories":{"label":"Calories","value":"180","unit":""},"servingSize":{"label":"Serving Size","value":"2.0","unit":"oz"},"fatContent":{"label":"Total Fat","value":"15","unit":"g"},"saturatedFatContent":{"label":"Saturated Fat","value":"5","unit":"g"},"transFatContent":{"label":"Trans Fat","value":"0","unit":"g"},"cholesterolContent":{"label":"Cholesterol","value":"45","unit":"mg"},"sodiumContent":{"label":"Sodium","value":"450","unit":"mg"},"carbohydrateContent":{"label":"Total Carbohydrate","value":"1","unit":"g"},"fiberContent":{"label":"Dietary Fiber","value":"0","unit":"g"},"sugarContent":{"label":"Sugars","value":"< 1","unit":"g"},"proteinContent":{"label":"Protein","value":"10","unit":"g"}}}]$facts$::jsonb)
on conflict(component_key) do update
  set published_serving_candidates=menu_components.published_serving_candidates||excluded.published_serving_candidates
  where not menu_components.published_serving_candidates @> excluded.published_serving_candidates;
