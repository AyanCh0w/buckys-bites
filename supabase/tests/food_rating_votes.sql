-- Run as postgres. All test users, items, reviews and votes are rolled back.
begin;

insert into auth.users (id) values
  ('00000000-0000-4000-8000-0000000000a2'),
  ('00000000-0000-4000-8000-0000000000b2'),
  ('00000000-0000-4000-8000-0000000000c2');

insert into public.food_items (id, source_namespace, source_item_id, name)
values ('00000000-0000-4000-8000-0000000000f2', 'scu-regression-test', 'rating-votes', 'Test item');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000a2', true);

do $$
declare
  rating public.food_ratings;
begin
  select * into strict rating from public.save_food_rating(
    '00000000-0000-4000-8000-0000000000f2', 5::smallint, 'Test review');
  assert not rating.is_shared;
  perform set_config('scu_test.review_id', rating.review_id::text, true);
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000b2', true);

do $$
declare
  review constant uuid := current_setting('scu_test.review_id')::uuid;
begin
  assert not exists (select 1 from public.shared_food_reviews where review_id = review);
  update public.food_ratings set is_shared = true where review_id = review;
  assert not found;

  begin
    perform public.save_food_rating_vote(review, 1::smallint);
    raise exception 'A private review could be voted on';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000a2', true);

do $$
declare
  review constant uuid := current_setting('scu_test.review_id')::uuid;
begin
  update public.food_ratings set is_shared = true where review_id = review;
  assert found;

  begin
    perform public.save_food_rating_vote(review, 1::smallint);
    raise exception 'A reviewer could vote on their own review';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000b2', true);

do $$
declare
  review constant uuid := current_setting('scu_test.review_id')::uuid;
  shared public.shared_food_reviews;
begin
  select * into strict shared from public.shared_food_reviews where review_id = review;
  assert shared.stars = 5 and shared.comment = 'Test review' and shared.vote_score = 0;
  assert not exists (select 1 from public.food_ratings where review_id = review);

  perform public.save_food_rating_vote(review, 1::smallint);
  perform public.save_food_rating_vote(review, 1::smallint);
  assert (select count(*) from public.food_rating_votes where review_id = review) = 1;

  begin
    perform public.save_food_rating_vote(review, 2::smallint);
    raise exception 'An invalid vote was accepted';
  exception when invalid_parameter_value then
    null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000c2', true);

do $$
declare
  review constant uuid := current_setting('scu_test.review_id')::uuid;
  shared public.shared_food_reviews;
begin
  assert not exists (select 1 from public.food_rating_votes where review_id = review);
  perform public.save_food_rating_vote(review, -1::smallint);
  select * into strict shared from public.shared_food_reviews where review_id = review;
  assert shared.up_votes = 1 and shared.down_votes = 1 and shared.vote_score = 0;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000b2', true);

do $$
declare
  review constant uuid := current_setting('scu_test.review_id')::uuid;
  shared public.shared_food_reviews;
begin
  perform public.save_food_rating_vote(review, -1::smallint);
  select * into strict shared from public.shared_food_reviews where review_id = review;
  assert shared.up_votes = 0 and shared.down_votes = 2 and shared.vote_score = -2;

  perform public.save_food_rating_vote(review, 0::smallint);
  assert not exists (select 1 from public.food_rating_votes where review_id = review);
  select * into strict shared from public.shared_food_reviews where review_id = review;
  assert shared.up_votes = 0 and shared.down_votes = 1 and shared.vote_score = -1;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000a2', true);

do $$
declare
  review constant uuid := current_setting('scu_test.review_id')::uuid;
begin
  update public.food_ratings set is_shared = false where review_id = review;
  assert not exists (select 1 from public.shared_food_reviews where review_id = review);
  delete from public.food_ratings where review_id = review;
  assert found;
end;
$$;

reset role;
do $$
begin
  assert not exists (
    select 1 from public.food_rating_votes
    where review_id = current_setting('scu_test.review_id')::uuid
  );
  assert not has_table_privilege('anon', 'public.shared_food_reviews', 'select');
  assert not has_table_privilege('anon', 'public.food_rating_votes', 'select');
  assert not has_function_privilege('anon', 'public.save_food_rating_vote(uuid,smallint)', 'execute');
  assert not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'shared_food_reviews'
      and column_name in ('user_id', 'voter_id')
  );
end;
$$;

select 'Review visibility, vote validation, privacy, score, change and removal passed' as result;
rollback;
