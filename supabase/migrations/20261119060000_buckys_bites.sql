begin;
-- Additive community model. Legacy food_ratings remain intact for older clients.
create table public.bites_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  avatar_id text not null default 'classic' check (avatar_id in ('classic','chef','scholar','athlete','music','sunglasses','beanie','night-owl')),
  created_at timestamptz not null default now()
);
create table public.bites_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferences jsonb not null default '{}' check (jsonb_typeof(preferences) = 'object' and octet_length(preferences::text) < 16000)
);
create table public.bites_eating_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  food_item_id uuid not null references public.food_items(id),
  log_id uuid unique references public.food_logs(id) on delete set null,
  eaten_at timestamptz not null,
  meal_label text not null,
  created_at timestamptz not null default now()
);
create index bites_history_user_food on public.bites_eating_history(user_id, food_item_id, eaten_at desc);
create table public.bites_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  food_item_id uuid not null references public.food_items(id),
  eating_id uuid references public.bites_eating_history(id) on delete set null,
  stars integer not null check (stars between 1 and 5),
  comment text check (char_length(comment) <= 2000),
  eaten_at timestamptz not null,
  meal_label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_hidden boolean not null default false
);
create index bites_reviews_food_user on public.bites_reviews(food_item_id, user_id, created_at desc, id desc);
create index bites_reviews_user on public.bites_reviews(user_id);
create index bites_reviews_eating on public.bites_reviews(eating_id);
-- Submission history prevents deleting a review from resetting the seven-day clock.
create table public.bites_review_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  food_item_id uuid not null references public.food_items(id),
  review_id uuid references public.bites_reviews(id) on delete set null,
  submitted_at timestamptz not null default now()
);
create index bites_submission_cooldown on public.bites_review_submissions(user_id, food_item_id, submitted_at desc);
create index bites_submission_review on public.bites_review_submissions(review_id);
create table public.bites_votes (
  user_id uuid not null references auth.users(id) on delete cascade,
  review_id uuid not null references public.bites_reviews(id) on delete cascade,
  vote smallint not null check (vote in (-1,1)),
  created_at timestamptz not null default now(),
  primary key(user_id,review_id)
);
create index bites_votes_review on public.bites_votes(review_id);
create table public.bites_reports (
  user_id uuid not null references auth.users(id) on delete cascade,
  review_id uuid not null references public.bites_reviews(id) on delete cascade,
  reason text not null check (char_length(btrim(reason)) between 1 and 500),
  created_at timestamptz not null default now(),
  primary key(user_id,review_id)
);
create index bites_reports_review on public.bites_reports(review_id);

do $$
declare t text;
begin
  foreach t in array array['bites_profiles','bites_preferences','bites_eating_history','bites_reviews','bites_review_submissions','bites_votes','bites_reports'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public, anon, authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
end $$;
grant select,insert,update on public.bites_profiles, public.bites_preferences to authenticated;
create policy own_profile on public.bites_profiles for all to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy own_preferences on public.bites_preferences for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select on public.bites_eating_history, public.bites_review_submissions, public.bites_votes to authenticated;
create policy own_history on public.bites_eating_history for select to authenticated using ((select auth.uid()) = user_id);
create policy own_submissions on public.bites_review_submissions for select to authenticated using ((select auth.uid()) = user_id);
create policy own_votes on public.bites_votes for select to authenticated using ((select auth.uid()) = user_id);
grant select,delete on public.bites_reviews to authenticated;
create policy own_reviews_read on public.bites_reviews for select to authenticated using ((select auth.uid()) = user_id);
create policy own_reviews_delete on public.bites_reviews for delete to authenticated using ((select auth.uid()) = user_id);
grant select,insert,update on public.bites_reports to authenticated;
create policy own_reports on public.bites_reports for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- The new app uses atomic RPCs. Existing food-log permissions remain compatible with older clients.

-- This definer view intentionally exposes ONLY public review fields and aggregate votes.
-- Eating time is rounded to the campus day. Private eating IDs are returned only to the owner.
create view public.bites_public_reviews with (security_barrier = true) as
with votes as (
  select review_id, count(*) filter (where vote=1)::integer as upvotes,
         count(*) filter (where vote=-1)::integer as downvotes, sum(vote)::integer as score
  from public.bites_votes group by review_id
), karma as (
  select r.user_id, coalesce(sum(v.score),0)::integer as karma
  from public.bites_reviews r left join votes v on v.review_id=r.id
  where not r.is_hidden group by r.user_id
)
select r.id,r.user_id,r.food_item_id,
  case when r.user_id=(select auth.uid()) then r.eating_id else null end as eating_id,
  r.stars,r.comment,
  (((r.eaten_at at time zone 'America/Los_Angeles')::date + time '12:00') at time zone 'America/Los_Angeles') as eaten_at,
  r.meal_label,r.created_at,r.updated_at,coalesce(p.display_name,'Bronco') as display_name,
  coalesce(k.karma,0) as karma,coalesce(v.upvotes,0) as upvotes,coalesce(v.downvotes,0) as downvotes,coalesce(v.score,0) as score,coalesce(p.avatar_id,'classic') as avatar_id
from public.bites_reviews r
left join public.bites_profiles p on p.id=r.user_id
left join votes v on v.review_id=r.id
left join karma k on k.user_id=r.user_id
where not r.is_hidden;
revoke all on public.bites_public_reviews from public,anon,authenticated;
grant select on public.bites_public_reviews to anon,authenticated;

create view public.bites_rating_stats with (security_barrier = true) as
select food_item_id, avg(stars)::numeric(3,2) as average, count(*)::integer as count
from (select distinct on (food_item_id,user_id) food_item_id,user_id,stars
      from public.bites_reviews where not is_hidden
      order by food_item_id,user_id,created_at desc,id desc) latest
group by food_item_id;
revoke all on public.bites_rating_stats from public,anon,authenticated;
grant select on public.bites_rating_stats to anon,authenticated;

create function public.bites_log_food(p_food_version_id uuid,p_servings numeric,p_meal text,p_eaten_at timestamptz default now())
returns uuid language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); l uuid; f uuid;
begin
  if u is null then raise exception 'Sign in to save your food.'; end if;
  if p_servings is null or p_servings <= 0 or p_servings > 100 or p_servings::text in ('NaN','Infinity','-Infinity') then raise exception 'Choose a valid portion.'; end if;
  if p_meal is null or p_meal not in ('Breakfast','Lunch','Dinner','Dessert','Snack') then raise exception 'Choose a meal period.'; end if;
  if p_eaten_at is null or p_eaten_at > now() or p_eaten_at < now()-interval '30 days' then raise exception 'Choose an eating time in the past 30 days.'; end if;
  select food_item_id into strict f from public.food_versions where id=p_food_version_id;
  insert into public.food_logs(user_id,food_version_id,servings,eaten_at,timezone,meal_label)
  values(u,p_food_version_id,p_servings,p_eaten_at,'America/Los_Angeles',p_meal) returning id into l;
  insert into public.bites_eating_history(user_id,food_item_id,log_id,eaten_at,meal_label) values(u,f,l,p_eaten_at,p_meal);
  insert into public.bites_profiles(id,display_name) select u,coalesce(nullif(left(btrim(raw_user_meta_data->>'display_name'),40),''),'Bronco') from auth.users where id=u on conflict do nothing;
  return l;
end $$;

create function public.bites_update_log(p_log_id uuid,p_servings numeric,p_meal text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if p_servings is null or p_servings <= 0 or p_servings > 100 or p_servings::text in ('NaN','Infinity','-Infinity') then raise exception 'Choose a valid portion.'; end if;
  if p_meal is null or p_meal not in ('Breakfast','Lunch','Dinner','Dessert','Snack') then raise exception 'Choose a meal period.'; end if;
  update public.food_logs set servings=p_servings,meal_label=p_meal where id=p_log_id and user_id=auth.uid();
  if not found then raise exception 'Food log not found.'; end if;
  update public.bites_eating_history set meal_label=p_meal where log_id=p_log_id and user_id=auth.uid();
end $$;

create function public.bites_delete_log(p_log_id uuid,p_review_id uuid default null,p_undo boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); h uuid; created timestamptz;
begin
  if u is null then raise exception 'Sign in first.'; end if;
  select created_at into created from public.food_logs where id=p_log_id and user_id=u for update;
  if not found then raise exception 'Food log not found.'; end if;
  select id into h from public.bites_eating_history where log_id=p_log_id and user_id=u;
  if p_review_id is not null then
    delete from public.bites_reviews where id=p_review_id and user_id=u and eating_id=h;
    if not found then raise exception 'That review is not associated with this food log.'; end if;
  end if;
  if p_undo then
    if created < now()-interval '2 minutes' or exists(select 1 from public.bites_reviews where eating_id=h) then raise exception 'Undo expired. Use the food-log deletion options.'; end if;
    delete from public.bites_eating_history where id=h and user_id=u;
  end if;
  delete from public.food_logs where id=p_log_id and user_id=u;
end $$;

create function public.bites_save_review(p_food_item_id uuid,p_stars integer,p_comment text default null,p_review_id uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); h public.bites_eating_history; r uuid; previous public.bites_reviews;
begin
  if u is null then raise exception 'Sign in to review.'; end if;
  if p_stars is null or p_stars not between 1 and 5 then raise exception 'Choose 1–5 Bucky stars.'; end if;
  if char_length(p_comment)>2000 then raise exception 'Keep reviews under 2,000 characters.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text || ':' || p_food_item_id::text,0));
  select * into h from public.bites_eating_history
  where user_id=u and food_item_id=p_food_item_id and eaten_at between now()-interval '72 hours' and now()
  order by eaten_at desc limit 1 for share;
  if not found then raise exception 'Eat and log this dish within the last 72 hours to review it.'; end if;
  if p_review_id is null then
    if exists(select 1 from public.bites_review_submissions where user_id=u and food_item_id=p_food_item_id and submitted_at > now()-interval '7 days') then raise exception 'Wait seven days between new reviews of the same dish.'; end if;
    insert into public.bites_reviews(user_id,food_item_id,eating_id,stars,comment,eaten_at,meal_label)
    values(u,p_food_item_id,h.id,p_stars,case when p_comment ~ '[^[:space:]]' then btrim(p_comment) else null end,h.eaten_at,h.meal_label) returning id into r;
    insert into public.bites_review_submissions(user_id,food_item_id,review_id) values(u,p_food_item_id,r);
  else
    select * into previous from public.bites_reviews where id=p_review_id and user_id=u and food_item_id=p_food_item_id and not is_hidden for update;
    if not found then raise exception 'Review not found.'; end if;
    update public.bites_reviews set stars=p_stars,comment=case when p_comment ~ '[^[:space:]]' then btrim(p_comment) else null end,updated_at=now(),eating_id=h.id,eaten_at=h.eaten_at,meal_label=h.meal_label where id=p_review_id;
    r:=p_review_id;
  end if;
  if not coalesce(p_comment ~ '[^[:space:]]',false) then delete from public.bites_votes where review_id=r; end if;
  return r;
end $$;

create function public.bites_vote(p_review_id uuid,p_vote integer)
returns void language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); r public.bites_reviews;
begin
  if u is null then raise exception 'Sign in to vote.'; end if;
  if p_vote is null or p_vote not in (-1,0,1) then raise exception 'Invalid vote.'; end if;
  -- Always let the owner remove their own vote, even after moderation or history changes.
  if p_vote=0 then delete from public.bites_votes where user_id=u and review_id=p_review_id; return; end if;
  select * into r from public.bites_reviews where id=p_review_id and not is_hidden for share;
  if not found then raise exception 'Review unavailable.'; end if;
  if not coalesce(r.comment ~ '[^[:space:]]',false) then raise exception 'Votes are for written reviews.'; end if;
  if r.user_id=u then raise exception 'You cannot vote on your own review.'; end if;
  if not exists(select 1 from public.bites_eating_history where user_id=u and food_item_id=r.food_item_id) then raise exception 'You can vote on reviews of dishes you have eaten.'; end if;
  insert into public.bites_votes(user_id,review_id,vote) values(u,p_review_id,p_vote)
  on conflict(user_id,review_id) do update set vote=excluded.vote;
end $$;

-- This deployment records deletion requests; it never deletes auth accounts.
create table public.bites_deletion_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now()
);
alter table public.bites_deletion_requests enable row level security;
revoke all on public.bites_deletion_requests from public,anon,authenticated;
grant select on public.bites_deletion_requests to authenticated;
grant all on public.bites_deletion_requests to service_role;
create policy own_deletion_request on public.bites_deletion_requests for select to authenticated using ((select auth.uid())=user_id);
create function public.bites_request_account_deletion()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  insert into public.bites_deletion_requests(user_id) values(auth.uid())
  on conflict(user_id) do update set requested_at=now();
end $$;

-- A minimal source for the developer's future dashboard, without stored per-user nutrient totals.
create view public.bites_developer_meals with (security_invoker=true) as
select l.id as log_id,l.user_id,l.food_version_id,f.food_item_id,f.name as dish_name,
       l.servings,l.meal_label,l.eaten_at,l.local_date
from public.food_logs l join public.food_versions f on f.id=l.food_version_id;
revoke all on public.bites_developer_meals from public,anon,authenticated;
grant select on public.bites_developer_meals to service_role;

-- Default EXECUTE to PUBLIC would bypass our explicit authentication boundary.
revoke all on function public.bites_log_food(uuid,numeric,text,timestamptz),public.bites_update_log(uuid,numeric,text),public.bites_delete_log(uuid,uuid,boolean),public.bites_save_review(uuid,integer,text,uuid),public.bites_vote(uuid,integer),public.bites_request_account_deletion() from public,anon,authenticated;
grant execute on function public.bites_log_food(uuid,numeric,text,timestamptz),public.bites_update_log(uuid,numeric,text),public.bites_delete_log(uuid,uuid,boolean),public.bites_save_review(uuid,integer,text,uuid),public.bites_vote(uuid,integer),public.bites_request_account_deletion() to authenticated;
commit;
