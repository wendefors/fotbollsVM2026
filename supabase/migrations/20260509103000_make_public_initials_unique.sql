alter table public.participants
  add column public_initials text;

create or replace function public.base_initials(first_name text, last_name text)
returns text
language sql
immutable
as $$
  select upper(left(coalesce(trim(first_name), ''), 1) || left(coalesce(trim(last_name), ''), 1));
$$;

create or replace function public.assign_public_initials()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate_base text;
  candidate text;
  suffix integer := 0;
begin
  candidate_base := nullif(public.base_initials(new.first_name, new.last_name), '');

  if candidate_base is null then
    candidate_base := 'XX';
  end if;

  loop
    if suffix = 0 then
      candidate := candidate_base;
    else
      candidate := candidate_base || suffix::text;
    end if;

    exit when not exists (
      select 1
      from public.participants
      where public_initials = candidate
        and id <> new.id
    );

    suffix := suffix + 1;
  end loop;

  new.public_initials := candidate;
  return new;
end;
$$;

create trigger assign_public_initials_before_insert
before insert on public.participants
for each row
execute function public.assign_public_initials();

update public.participants
set public_initials = initials
where public_initials is null;

with duplicates as (
  select
    id,
    initials,
    row_number() over (partition by initials order by created_at, id) as duplicate_index
  from public.participants
)
update public.participants
set public_initials = case
  when duplicates.duplicate_index = 1 then duplicates.initials
  else duplicates.initials || (duplicates.duplicate_index - 1)::text
end
from duplicates
where participants.id = duplicates.id;

alter table public.participants
  alter column public_initials set not null;

create unique index participants_public_initials_key
on public.participants (public_initials);

create or replace view public.public_predictions as
select
  predictions.id,
  participants.public_initials as initials,
  predictions.sweden_matches,
  predictions.group_predictions,
  predictions.podium,
  predictions.points,
  predictions.created_at
from public.predictions
join public.participants on participants.id = predictions.participant_id;
