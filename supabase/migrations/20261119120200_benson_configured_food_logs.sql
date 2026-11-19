alter table public.food_logs add column menu_selection jsonb
  check (jsonb_typeof(menu_selection)='object');

-- Use the ordinary log RPC and the same food identity for history and reviews.
-- When a serving or preparation differs from the published one, use an immutable
-- version with unknown totals, so every existing accounting consumer is correct.
create function public.bites_log_configured_food(
  p_offering_id uuid, p_servings numeric, p_meal text, p_eaten_at timestamptz,
  p_size text, p_choices text[]
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  base public.food_versions%rowtype;
  offer public.menu_offerings%rowtype;
  serving jsonb; option_group jsonb; option_value jsonb; selected jsonb:='[]';
  ids text[]:=coalesce(p_choices,'{}'); n integer; kept integer:=0;
  log_id uuid; version_id uuid; fingerprint text; variable_recipe boolean:=false;
begin
  if auth.uid() is null then raise exception 'Sign in to save your food.'; end if;
  select * into strict offer from public.menu_offerings where id=p_offering_id;
  select * into strict base from public.food_versions where id=offer.food_version_id;
  if p_size is not null then
    select v into strict serving from jsonb_array_elements(offer.serving_options) v where v->>'label'=p_size;
  end if;
  foreach option_group in array array(select jsonb_array_elements(offer.modifier_groups)) loop
    n:=0;
    for option_value in select v from jsonb_array_elements(option_group->'options') v where v->>'key'=any(ids) loop
      n:=n+1;
      kept:=kept+1;
      variable_recipe:=variable_recipe or coalesce((option_value->>'default')::boolean,false)=false;
      selected:=selected||jsonb_build_array(jsonb_build_object('group',option_group->>'name','label',option_value->>'label'));
    end loop;
    if (option_group->>'min' is not null and n<(option_group->>'min')::int)
      or (option_group->>'max' is not null and n>(option_group->>'max')::int) then
      raise exception 'Choose a valid number of options for %.',option_group->>'name';
    end if;
  end loop;
  if kept<>cardinality(ids) then raise exception 'Choose options from this dish.'; end if;
  version_id:=base.id;
  if base.nutrition_source='published' and (variable_recipe or (serving is not null
      and coalesce((serving->>'published_serving')::boolean,false)=false)) then
    fingerprint:='logged-configuration:'||base.id::text||':'||md5(coalesce(p_size,''));
    insert into public.food_versions(food_item_id,content_hash,name,serving_description,nutrition_source,source_url,captured_at)
    values(base.food_item_id,fingerprint,base.name,p_size,'unavailable',base.source_url,base.captured_at)
    on conflict(food_item_id,content_hash) do nothing;
    select id into strict version_id from public.food_versions
      where food_item_id=base.food_item_id and content_hash=fingerprint;
  end if;
  log_id:=public.bites_log_food(version_id,p_servings,p_meal,p_eaten_at);
  update public.food_logs set menu_selection=jsonb_strip_nulls(jsonb_build_object(
    'offering_id',p_offering_id,'size',p_size,'choices',selected)) where id=log_id;
  return log_id;
end $$;
revoke all on function public.bites_log_configured_food(uuid,numeric,text,timestamptz,text,text[]) from public,anon,authenticated;
grant execute on function public.bites_log_configured_food(uuid,numeric,text,timestamptz,text,text[]) to authenticated;
