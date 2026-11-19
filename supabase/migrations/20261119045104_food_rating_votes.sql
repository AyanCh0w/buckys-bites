begin;

alter table public.food_ratings
  add column review_id uuid not null unique default gen_random_uuid(),
  add column is_shared boolean not null default false;

-- The existing owner policy also covers the sharing setting.
grant update (is_shared) on public.food_ratings to authenticated;

create index food_ratings_shared_item_idx on public.food_ratings (food_item_id) where is_shared;

create table public.food_rating_votes (
  review_id uuid not null references public.food_ratings(review_id) on delete cascade,
  voter_id uuid not null references auth.users(id) on delete cascade,
  vote smallint not null check (vote in (-1, 1)),
  primary key (review_id, voter_id)
);

create index food_rating_votes_voter_idx on public.food_rating_votes (voter_id);

alter table public.food_rating_votes enable row level security;
revoke all on table public.food_rating_votes from public, anon, authenticated;
grant select on table public.food_rating_votes to authenticated;
grant all on table public.food_rating_votes to service_role;

create policy read_own_votes on public.food_rating_votes for select to authenticated
  using ((select auth.uid()) = voter_id);

-- This read-only view exposes only deliberately shared reviews and totals.
create view public.shared_food_reviews with (security_barrier = true, security_invoker = false) as
select r.review_id, r.food_item_id, r.stars, r.comment,
       totals.up_votes, totals.down_votes, totals.up_votes - totals.down_votes as vote_score
from public.food_ratings r
cross join lateral (
  select count(*) filter (where v.vote = 1) as up_votes,
         count(*) filter (where v.vote = -1) as down_votes
  from public.food_rating_votes v
  where v.review_id = r.review_id
) totals
where r.is_shared;

revoke all on table public.shared_food_reviews from public, anon, authenticated;
grant select on table public.shared_food_reviews to authenticated, service_role;

-- The caller can affect only their own vote. Zero removes a vote.
create function public.save_food_rating_vote(p_review_id uuid, p_vote smallint)
returns smallint
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'Sign in to vote' using errcode = '42501';
  end if;
  if p_vote is null or p_vote not in (-1, 0, 1) then
    raise exception 'Vote must be -1, 0, or 1' using errcode = '22023';
  end if;

  if p_vote = 0 then
    delete from public.food_rating_votes where review_id = p_review_id and voter_id = caller;
    return 0;
  end if;

  -- Prevent a concurrent unshare or delete between authorization and the write.
  perform 1 from public.food_ratings
  where review_id = p_review_id and is_shared and user_id <> caller
  for share;
  if not found then
    raise exception 'This review is unavailable for voting' using errcode = '42501';
  end if;

  insert into public.food_rating_votes (review_id, voter_id, vote)
  values (p_review_id, caller, p_vote)
  on conflict (review_id, voter_id) do update set vote = excluded.vote;
  return p_vote;
end;
$$;

revoke all on function public.save_food_rating_vote(uuid, smallint) from public, anon, authenticated;
grant execute on function public.save_food_rating_vote(uuid, smallint) to authenticated;

commit;
