-- Prepared/menu components are separate from raw recipe ingredients.
begin;

alter table public.food_versions
  add column published_nutrition jsonb not null default '{}'::jsonb
  check (jsonb_typeof(published_nutrition) = 'object');

create table public.menu_components (
  id uuid primary key default gen_random_uuid(),
  component_key text not null unique,
  name text not null,
  published_serving_candidates jsonb not null default '[]'::jsonb
    check (jsonb_typeof(published_serving_candidates) = 'array')
);

-- Options at the same position and in the same choice group are alternatives.
create table public.food_version_components (
  food_version_id uuid not null references public.food_versions(id),
  position integer not null check (position >= 0),
  option_position integer not null default 0 check (option_position >= 0),
  component_id uuid not null references public.menu_components(id),
  display_label text not null,
  choice_group text,
  primary key (food_version_id, position, option_position),
  check (choice_group is not null or option_position = 0)
);

create index food_version_components_component_idx
  on public.food_version_components (component_id);

-- Exact source recipe breakdown. Visual links are curated independently above.
create table public.food_version_recipe_components (
  food_version_id uuid not null references public.food_versions(id),
  position integer not null check (position >= 0),
  source_recipe_id text not null,
  name text not null,
  source_group text not null check (source_group in ('entrees', 'sides')),
  nutrition_status text not null check (nutrition_status in (
    'unavailable', 'published_in_dish_option', 'same_station_same_recipe_same_serving',
    'estimated_same_recipe_unconfirmed_in_dish_portion', 'estimated_different_scu_recipe_and_portion',
    'estimated_generic_bon_appetit_portion'
  )),
  serving_evidence jsonb check (jsonb_typeof(serving_evidence) = 'object'),
  primary key (food_version_id, position),
  check ((nutrition_status = 'unavailable') = (serving_evidence is null))
);

create table public.food_version_nutrition_audits (
  food_version_id uuid primary key references public.food_versions(id),
  status text not null check (status in ('verified_display_match', 'estimated_scenario', 'unresolved')),
  comparison jsonb check (jsonb_typeof(comparison) = 'object'),
  implied_main_estimate jsonb check (jsonb_typeof(implied_main_estimate) = 'object'),
  option_comparison jsonb check (jsonb_typeof(option_comparison) = 'object'),
  check ((status = 'unresolved') = (comparison is null)),
  check (implied_main_estimate is null or status = 'unresolved')
);

-- Store the exact prompt and generator settings now. Storage locations are set
-- only when the corresponding files are uploaded and verified.
create table public.catalog_image_assets (
  image_key text primary key,
  food_item_id uuid unique references public.food_items(id),
  component_id uuid unique references public.menu_components(id),
  prompt text not null,
  generator_settings jsonb not null check (jsonb_typeof(generator_settings) = 'object'),
  storage_bucket text,
  storage_object_path text,
  check ((food_item_id is null) <> (component_id is null)),
  check ((storage_bucket is null) = (storage_object_path is null)),
  unique (storage_bucket, storage_object_path)
);

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'menu_components', 'food_version_components', 'food_version_recipe_components',
    'food_version_nutrition_audits', 'catalog_image_assets'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from public, anon, authenticated', table_name);
    execute format('grant all on table public.%I to service_role', table_name);
  end loop;
end;
$$;

commit;
