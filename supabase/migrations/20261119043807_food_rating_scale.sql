begin;

-- A missing rating is represented by the absence of a row.
alter table public.food_ratings
  drop constraint food_ratings_stars_check,
  add constraint food_ratings_stars_check check (stars between 1 and 5);

-- Rebuild the derived view with a 1–5 histogram. The ratings table is preserved.
drop view public.food_rating_stats;
create view public.food_rating_stats with (security_barrier = true, security_invoker = false) as
select food_item_id,
       count(*) as rating_count,
       avg(stars) as average_stars,
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
