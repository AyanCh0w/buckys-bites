begin;

-- Ratings follow the stable food item across menu dates and versions.
create table public.food_ratings (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  food_item_id uuid not null references public.food_items(id),
  stars smallint not null check (stars between 0 and 5),
  comment text check (comment is null or char_length(comment) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, food_item_id)
);

create index food_ratings_item_idx on public.food_ratings (food_item_id);
create index food_ratings_user_updated_idx on public.food_ratings (user_id, updated_at desc);

alter table public.food_ratings enable row level security;
revoke all on table public.food_ratings from public, anon, authenticated;
grant select, delete on table public.food_ratings to authenticated;
grant insert (food_item_id, stars, comment), update (stars, comment)
  on table public.food_ratings to authenticated;
grant all on table public.food_ratings to service_role;

create policy owner_access on public.food_ratings for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create function public.set_food_rating_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := statement_timestamp();
  return new;
end;
$$;
revoke all on function public.set_food_rating_updated_at() from public, anon, authenticated;

create trigger food_rating_updated_at
before update on public.food_ratings
for each row execute function public.set_food_rating_updated_at();

-- Call as the signed-in user. Resubmitting the same item edits the existing rating.
create function public.save_food_rating(p_food_item_id uuid, p_stars smallint, p_comment text default null)
returns public.food_ratings
language sql
security invoker
set search_path = ''
as $$
  insert into public.food_ratings (food_item_id, stars, comment)
  values (p_food_item_id, p_stars, nullif(btrim(p_comment), ''))
  on conflict (user_id, food_item_id) do update
    set stars = excluded.stars, comment = excluded.comment
  returning *;
$$;
revoke all on function public.save_food_rating(uuid, smallint, text) from public, anon, authenticated;
grant execute on function public.save_food_rating(uuid, smallint, text) to authenticated;

-- The view owner can count all ratings. Callers receive only item-level aggregates.
create view public.food_rating_stats with (security_barrier = true, security_invoker = false) as
select food_item_id,
       count(*) as rating_count,
       avg(stars) as average_stars,
       count(*) filter (where stars = 0) as stars_0_count,
       count(*) filter (where stars = 1) as stars_1_count,
       count(*) filter (where stars = 2) as stars_2_count,
       count(*) filter (where stars = 3) as stars_3_count,
       count(*) filter (where stars = 4) as stars_4_count,
       count(*) filter (where stars = 5) as stars_5_count
from public.food_ratings
group by food_item_id;

revoke all on table public.food_rating_stats from public, anon, authenticated;
grant select on table public.food_rating_stats to authenticated, service_role;

commit;
