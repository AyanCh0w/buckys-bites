-- The Fire publishes the burger recipe separately from the station's list of
-- substitutions. Materialize them together so the picker and the nutrition RPC
-- use the same defaults, including the ordinary bun and the included side.
create function benson_private.burger_modifier_groups(groups jsonb, recipes text[])
returns jsonb language sql stable set search_path = '' as $$
  with recipe_options(recipe, section, label, station_item, component) as (values
    ('75613196','Bread and wraps','Hamburger bun',null,'component:hamburger-bun'),
    ('70647210','Bread and wraps','Hamburger bun',null,'component:hamburger-bun'),
    ('70647242','Proteins','Single beef patty','23020297','component:beef-patty'),
    ('70650362','Cheese','American cheese','23020304','component:american-cheese'),
    ('51721','Toppings','Caramelized onions',null,'component:caramelized-onions'),
    ('70818653','Toppings','Dill pickle relish',null,null),
    ('70642625','Sauces and spreads','Mayonnaise','16878410',null),
    ('47957.12','Sauces and spreads','Ketchup','16878409',null),
    ('70855576','Sauces and spreads','Mustard','16878408',null),
    ('35685','Side','Seasoned fries',null,'component:seasoned-fries'),
    ('46495','Side','French fries',null,'component:french-fries'),
    ('80448','Fountain choices','Coke','36667109','component:coke'),
    ('70651035','Add-On','Bacon','23020647','component:bacon')
  ), included as (
    select *, 'component:benson:18696:' || station_item as station_key
    from recipe_options where recipe = any(recipes)
  ), sections as (
    select entry->>'name' as section, entry-'options' as props, position
    from jsonb_array_elements(groups) with ordinality g(entry,position)
  ), station_options as (
    select case when option->>'key'='component:benson:18696:23020296'
                then 'Bread and wraps' else entry->>'name' end as section,
           option, position
    from jsonb_array_elements(groups) entry
    cross join lateral jsonb_array_elements(entry->'options') with ordinality o(option,position)
    where option->>'key' not like 'burger-recipe:%'
  ), choices as (
    select station.section,
           case when included.recipe is null then station.option - 'default'
                else station.option || '{"default":true}'::jsonb end as option,
           station.position
    from station_options station left join included on included.station_key=station.option->>'key'
    union all
    select included.section, jsonb_strip_nulls(jsonb_build_object(
      'key','burger-recipe:' || recipe,'label',label,'default',true,'component_id',c.id
    )), 0
    from included left join public.menu_components c on c.component_key=included.component
    where not exists (select from station_options where option->>'key'=included.station_key)
  ), grouped as (
    select section,jsonb_agg(option order by (option->>'default')::boolean desc nulls last,
                                         position,option->>'key') as options
    from choices group by section
  )
  select coalesce(jsonb_agg(coalesce(s.props,jsonb_build_object('name',g.section))
    || case when g.section='Bread and wraps' then '{"max":1}'::jsonb else '{}'::jsonb end
    || jsonb_build_object('options',g.options) order by s.position nulls last,g.section),'[]')
  from grouped g left join sections s using(section)
$$;

create function benson_private.set_burger_recipe_defaults()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.modifier_groups := benson_private.burger_modifier_groups(
    new.modifier_groups,
    (select source_recipe_ids from public.food_versions where id=new.food_version_id)
  );
  return new;
end $$;

create trigger burger_recipe_defaults
before insert or update of modifier_groups, food_version_id, source_occurrence_key on public.menu_offerings
for each row when (new.source_occurrence_key in ('18696:23020878','18696:26412070','18696:26412088'))
execute function benson_private.set_burger_recipe_defaults();

-- Refresh existing placements without changing historical food versions or logs.
update public.menu_offerings set modifier_groups=modifier_groups
where source_occurrence_key in ('18696:23020878','18696:26412070','18696:26412088');
