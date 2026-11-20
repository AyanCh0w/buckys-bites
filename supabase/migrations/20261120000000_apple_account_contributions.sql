-- Enforce the account requirement for both direct client writes and the
-- security-definer RPCs used by the review and food log forms.
create function public.bites_require_apple_account()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  claims jsonb := auth.jwt();
  metadata jsonb := claims -> 'app_metadata';
begin
  if coalesce((claims ->> 'is_anonymous')::boolean, false)
     or not coalesce(metadata ->> 'provider' = 'apple'
                     or (metadata -> 'providers') @> '["apple"]'::jsonb, false) then
    raise exception 'Sign in with Apple to write a review or add food.' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.bites_require_apple_account() from public, anon, authenticated;

create trigger bites_require_apple_for_food
before insert on public.food_logs
for each row when (auth.uid() is not null)
execute function public.bites_require_apple_account();

create trigger bites_require_apple_for_review
before insert or update of stars, comment on public.bites_reviews
for each row when (auth.uid() is not null)
execute function public.bites_require_apple_account();
