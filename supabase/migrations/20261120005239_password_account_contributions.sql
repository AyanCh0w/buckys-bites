create function public.bites_require_account()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  claims jsonb := auth.jwt();
  metadata jsonb := claims -> 'app_metadata';
begin
  if coalesce((claims ->> 'is_anonymous')::boolean, false)
     or not coalesce(metadata ->> 'provider' in ('apple', 'email')
                     or (metadata -> 'providers') ?| array['apple', 'email'], false) then
    raise exception 'Sign in to write a review or add food.' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.bites_require_account() from public, anon, authenticated;

drop trigger if exists bites_require_apple_for_food on public.food_logs;
drop trigger if exists bites_require_apple_for_review on public.bites_reviews;
drop function if exists public.bites_require_apple_account();

create trigger bites_require_account_for_food
before insert on public.food_logs
for each row when (auth.uid() is not null)
execute function public.bites_require_account();

create trigger bites_require_account_for_review
before insert or update of stars, comment on public.bites_reviews
for each row when (auth.uid() is not null)
execute function public.bites_require_account();
