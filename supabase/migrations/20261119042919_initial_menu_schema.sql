-- Initial migration for a NEW Supabase project. Run once via migrations or SQL Editor.
begin;

create table public.cafes (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  name text not null,
  timezone text not null default 'America/Los_Angeles',
  source_url text not null,
  active boolean not null default true
);

create table public.stations (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes(id),
  source_key text not null,
  name text not null,
  unique (cafe_id, source_key),
  unique (id, cafe_id)
);

-- Backend-only audit records. Raw payloads help debug changes to the source.
create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes(id),
  service_date date not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running'
    check (status in ('running', 'succeeded', 'failed')),
  source_url text not null,
  raw_payload jsonb,
  error_message text,
  check (completed_at is null or completed_at >= started_at)
);

create table public.food_items (
  id uuid primary key default gen_random_uuid(),
  source_namespace text not null default 'scudining.cafebonappetit.com',
  source_item_id text not null,
  name text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (source_namespace, source_item_id)
);

-- Immutable snapshot: create another row when content or nutrition changes.
-- All nutrients refer to ONE published serving; NULL means unknown.
create table public.food_versions (
  id uuid primary key default gen_random_uuid(),
  food_item_id uuid not null references public.food_items(id),
  content_hash text not null,
  name text not null,
  description text,
  ingredients_text text,
  source_recipe_ids text[] not null default '{}',
  dietary_tags text[] not null default '{}',
  allergen_tags text[] not null default '{}',
  allergen_information_available boolean not null default false,
  serving_description text,
  serving_weight_g numeric check (serving_weight_g > 0),
  calories_kcal numeric check (calories_kcal >= 0),
  protein_g numeric check (protein_g >= 0),
  carbohydrate_g numeric check (carbohydrate_g >= 0),
  total_fat_g numeric check (total_fat_g >= 0),
  saturated_fat_g numeric check (saturated_fat_g >= 0),
  trans_fat_g numeric check (trans_fat_g >= 0),
  fiber_g numeric check (fiber_g >= 0),
  sugar_g numeric check (sugar_g >= 0),
  sodium_mg numeric check (sodium_mg >= 0),
  cholesterol_mg numeric check (cholesterol_mg >= 0),
  nutrition_source text not null default 'unavailable'
    check (nutrition_source in ('published', 'estimated', 'unavailable')),
  source_url text not null,
  captured_at timestamptz not null default now(),
  unique (food_item_id, content_hash)
);

-- Optional normalized ingredient catalog. Original text remains authoritative.
create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  ingredient_key text not null unique,
  name text not null
);

create table public.food_ingredients (
  food_version_id uuid not null references public.food_versions(id),
  position integer not null check (position >= 0),
  ingredient_id uuid not null references public.ingredients(id),
  source_text text not null,
  quantity_g numeric check (quantity_g > 0),
  mapping_status text not null default 'parsed'
    check (mapping_status in ('parsed', 'verified')),
  primary key (food_version_id, position)
);

-- Optional: only populate from a verified ingredient source. Per 100 grams.
-- Never infer these numbers or recipe quantities from a dish's totals.
create table public.ingredient_nutrition (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references public.ingredients(id),
  source_name text not null,
  source_record_id text not null,
  source_url text not null,
  preparation text not null,
  calories_kcal numeric check (calories_kcal >= 0),
  protein_g numeric check (protein_g >= 0),
  carbohydrate_g numeric check (carbohydrate_g >= 0),
  total_fat_g numeric check (total_fat_g >= 0),
  saturated_fat_g numeric check (saturated_fat_g >= 0),
  trans_fat_g numeric check (trans_fat_g >= 0),
  fiber_g numeric check (fiber_g >= 0),
  sugar_g numeric check (sugar_g >= 0),
  sodium_mg numeric check (sodium_mg >= 0),
  cholesterol_mg numeric check (cholesterol_mg >= 0),
  captured_at timestamptz not null default now(),
  unique (ingredient_id, source_name, source_record_id, preparation)
);

-- One meal period at one cafe on one local calendar date.
-- source_key must distinguish two different periods both named "Lunch".
create table public.menu_services (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes(id),
  service_date date not null,
  source_key text not null,
  name text not null,
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'unpublished'
    check (status in ('published', 'closed', 'unpublished')),
  last_successful_sync_at timestamptz,
  unique (cafe_id, service_date, source_key),
  unique (id, cafe_id),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table public.menu_offerings (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes(id),
  menu_service_id uuid not null,
  station_id uuid,
  food_version_id uuid not null references public.food_versions(id),
  source_occurrence_key text not null,
  menu_section text,
  price numeric(10,2) check (price >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  sort_order integer not null default 0,
  is_listed boolean not null default true,
  last_seen_at timestamptz not null default now(),
  foreign key (menu_service_id, cafe_id) references public.menu_services(id, cafe_id),
  foreign key (station_id, cafe_id) references public.stations(id, cafe_id),
  unique (menu_service_id, source_occurrence_key)
);

-- Future tracking: referring to an immutable version preserves historical totals.
create table public.food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  food_version_id uuid not null references public.food_versions(id),
  servings numeric not null check (servings > 0 and servings <= 100),
  eaten_at timestamptz not null default now(),
  local_date date not null,
  timezone text not null default 'America/Los_Angeles',
  meal_label text,
  notes text,
  created_at timestamptz not null default now()
);

create table public.favorites (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  food_item_id uuid not null references public.food_items(id),
  created_at timestamptz not null default now(),
  primary key (user_id, food_item_id)
);

create index food_versions_item_date_idx on public.food_versions (food_item_id, captured_at desc);
create index food_versions_dietary_idx on public.food_versions using gin (dietary_tags);
create index food_ingredients_ingredient_idx on public.food_ingredients (ingredient_id);
create index offerings_version_idx on public.menu_offerings (food_version_id);
create index offerings_station_idx on public.menu_offerings (station_id);
create index food_logs_user_date_idx on public.food_logs (user_id, local_date);
create index food_logs_version_idx on public.food_logs (food_version_id);
create index favorites_item_idx on public.favorites (food_item_id);
create index sync_runs_cafe_date_idx on public.sync_runs (cafe_id, service_date, started_at desc);

create function public.reject_food_version_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Food versions are immutable. Insert a new version instead.';
end;
$$;
revoke all on function public.reject_food_version_mutation() from public, anon, authenticated;
create trigger immutable_food_versions
before update or delete on public.food_versions
for each row execute function public.reject_food_version_mutation();

-- Keep diary date consistent with the user's chosen timezone and eating time.
create function public.set_food_log_date()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.local_date := (new.eaten_at at time zone new.timezone)::date;
  return new;
end;
$$;
revoke all on function public.set_food_log_date() from public, anon, authenticated;
create trigger food_log_local_date
before insert or update on public.food_logs
for each row execute function public.set_food_log_date();

-- Explicit privileges plus RLS: public catalog reads; backend-only catalog writes.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'cafes', 'stations', 'food_items', 'food_versions', 'ingredients',
    'food_ingredients', 'ingredient_nutrition', 'menu_services', 'menu_offerings'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from public, anon, authenticated', table_name);
    execute format('grant select on table public.%I to anon, authenticated', table_name);
    execute format('grant all on table public.%I to service_role', table_name);
    execute format('create policy catalog_read on public.%I for select to anon, authenticated using (true)', table_name);
  end loop;
end;
$$;

alter table public.sync_runs enable row level security;
revoke all on table public.sync_runs from public, anon, authenticated;
grant all on table public.sync_runs to service_role;

do $$
declare table_name text;
begin
  foreach table_name in array array['food_logs', 'favorites'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from public, anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', table_name);
    execute format('grant all on table public.%I to service_role', table_name);
    execute format('create policy owner_access on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', table_name);
  end loop;
end;
$$;

commit;
