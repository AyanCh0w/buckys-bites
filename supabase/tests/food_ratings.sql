-- Run as postgres. Test users, item and ratings are rolled back.
begin;

insert into auth.users (id) values
  ('00000000-0000-4000-8000-0000000000a1'),
  ('00000000-0000-4000-8000-0000000000b1');

insert into public.food_items (id, source_namespace, source_item_id, name)
values ('00000000-0000-4000-8000-0000000000f1', 'scu-regression-test', 'ratings', 'Test item');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000a1', true);

do $$
declare
  food constant uuid := '00000000-0000-4000-8000-0000000000f1';
  rating public.food_ratings;
begin
  assert not exists (select 1 from public.food_rating_stats where food_item_id = food);
  select * into strict rating from public.save_food_rating(food, 1::smallint, ' Test comment ');
  assert rating.user_id = auth.uid() and rating.stars = 1 and rating.comment = 'Test comment';

  begin
    perform public.save_food_rating(food, 0::smallint);
    raise exception 'Zero was accepted as a saved rating';
  exception when check_violation then
    null;
  end;
  assert (select count(*) from public.food_ratings where food_item_id = food) = 1;

  begin
    perform public.save_food_rating(food, 6::smallint);
    raise exception 'Out-of-range stars were accepted';
  exception when check_violation then
    null;
  end;

  begin
    perform public.save_food_rating(food, -1::smallint);
    raise exception 'Negative stars were accepted';
  exception when check_violation then
    null;
  end;

  begin
    perform public.save_food_rating(food, 3::smallint, repeat('x', 2001));
    raise exception 'An oversized comment was accepted';
  exception when check_violation then
    null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000b1', true);

do $$
declare
  food constant uuid := '00000000-0000-4000-8000-0000000000f1';
  stats public.food_rating_stats;
begin
  assert not exists (select 1 from public.food_ratings where food_item_id = food);
  update public.food_ratings set stars = 1 where food_item_id = food;
  assert not found;
  delete from public.food_ratings where food_item_id = food;
  assert not found;

  begin
    insert into public.food_ratings (user_id, food_item_id, stars)
    values ('00000000-0000-4000-8000-0000000000a1', food, 3);
    raise exception 'Rating impersonation was accepted';
  exception when insufficient_privilege then
    null;
  end;

  perform public.save_food_rating(food, 5::smallint);
  assert (select count(*) from public.food_ratings where food_item_id = food) = 1;
  select * into strict stats from public.food_rating_stats where food_item_id = food;
  assert stats.rating_count = 2 and stats.average_stars = 3;
  assert stats.stars_1_count = 1 and stats.stars_5_count = 1;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000a1', true);

do $$
declare
  food constant uuid := '00000000-0000-4000-8000-0000000000f1';
  rating public.food_ratings;
  stats public.food_rating_stats;
begin
  select * into strict rating from public.save_food_rating(food, 4::smallint, ' ');
  assert rating.stars = 4 and rating.comment is null;
  assert rating.updated_at >= rating.created_at;
  assert (select count(*) from public.food_ratings where food_item_id = food) = 1;

  select * into strict stats from public.food_rating_stats where food_item_id = food;
  assert stats.rating_count = 2 and stats.average_stars = 4.5 and stats.stars_4_count = 1;

  delete from public.food_ratings where food_item_id = food;
  assert found;
  select * into strict stats from public.food_rating_stats where food_item_id = food;
  assert stats.rating_count = 1 and stats.average_stars = 5;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000b1', true);
do $$
declare
  food constant uuid := '00000000-0000-4000-8000-0000000000f1';
begin
  delete from public.food_ratings where food_item_id = food;
  assert found;
  assert not exists (select 1 from public.food_rating_stats where food_item_id = food);
end;
$$;

reset role;
do $$
begin
  assert not has_table_privilege('anon', 'public.food_ratings', 'select');
  assert not has_table_privilege('anon', 'public.food_rating_stats', 'select');
  assert not has_function_privilege('anon', 'public.save_food_rating(uuid,smallint,text)', 'execute');
  assert not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'food_rating_stats'
      and column_name in ('user_id', 'comment', 'stars_0_count')
  );
end;
$$;

select 'food rating write, privacy and aggregate checks passed' as result;
rollback;
