create or replace function public.prevent_duplicate_participant_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(trim(coalesce(new.email, '')), '') is null then
    return new;
  end if;

  if exists (
    select 1
    from public.participants
    where lower(trim(email)) = lower(trim(new.email))
      and id <> new.id
  ) then
    raise unique_violation using message = 'email already used';
  end if;

  return new;
end;
$$;

create trigger prevent_duplicate_participant_email_before_insert
before insert on public.participants
for each row
execute function public.prevent_duplicate_participant_email();
