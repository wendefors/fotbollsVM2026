create extension if not exists pgcrypto;

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  phone text not null,
  email text not null,
  initials text generated always as (
    upper(left(trim(first_name), 1) || left(trim(last_name), 1))
  ) stored,
  created_at timestamptz not null default now()
);

create table public.predictions (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  sweden_matches jsonb not null,
  group_predictions jsonb not null,
  podium jsonb not null,
  points integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.tournament_results (
  id uuid primary key default gen_random_uuid(),
  result_type text not null check (result_type in ('sweden_match', 'group', 'podium')),
  result_key text not null,
  result_payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (result_type, result_key)
);

create view public.public_predictions as
select
  predictions.id,
  participants.initials,
  predictions.sweden_matches,
  predictions.group_predictions,
  predictions.podium,
  predictions.points,
  predictions.created_at
from public.predictions
join public.participants on participants.id = predictions.participant_id;

alter table public.participants enable row level security;
alter table public.predictions enable row level security;
alter table public.tournament_results enable row level security;

create policy "Allow anonymous participant inserts"
on public.participants
for insert
to anon
with check (created_at <= '2026-06-11 22:00:00+02'::timestamptz);

create policy "Allow anonymous prediction inserts"
on public.predictions
for insert
to anon
with check (created_at <= '2026-06-11 22:00:00+02'::timestamptz);

create policy "Allow anonymous result reads"
on public.tournament_results
for select
to anon
using (true);

grant select on public.public_predictions to anon;
grant insert on public.participants to anon;
grant insert on public.predictions to anon;
grant select on public.tournament_results to anon;
