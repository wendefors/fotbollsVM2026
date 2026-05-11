create table public.prediction_scores (
  prediction_id uuid primary key references public.predictions(id) on delete cascade,
  sweden_points integer not null default 0,
  group_points integer not null default 0,
  podium_points integer not null default 0,
  statistics_points integer not null default 0,
  total_points integer generated always as (
    sweden_points + group_points + podium_points + statistics_points
  ) stored,
  tie_breaker_distance integer,
  updated_at timestamptz not null default now()
);

alter table public.prediction_scores enable row level security;

create policy "Allow anonymous score reads"
on public.prediction_scores
for select
to anon
using (true);

insert into public.prediction_scores (prediction_id)
select predictions.id
from public.predictions
on conflict (prediction_id) do nothing;

create or replace function public.create_prediction_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.prediction_scores (prediction_id)
  values (new.id)
  on conflict (prediction_id) do nothing;

  return new;
end;
$$;

create trigger create_prediction_score_after_insert
after insert on public.predictions
for each row
execute function public.create_prediction_score();

drop view if exists public.public_predictions;

create view public.public_predictions as
select
  predictions.id,
  participants.public_initials as initials,
  predictions.sweden_matches,
  predictions.group_predictions,
  predictions.podium,
  predictions.tournament_questions,
  predictions.tie_breaker,
  coalesce(prediction_scores.sweden_points, 0) as sweden_points,
  coalesce(prediction_scores.group_points, 0) as group_points,
  coalesce(prediction_scores.podium_points, 0) as podium_points,
  coalesce(prediction_scores.statistics_points, 0) as statistics_points,
  coalesce(prediction_scores.total_points, 0) as points,
  prediction_scores.tie_breaker_distance,
  predictions.created_at
from public.predictions
join public.participants on participants.id = predictions.participant_id
left join public.prediction_scores on prediction_scores.prediction_id = predictions.id;

grant select on public.public_predictions to anon;
grant select on public.prediction_scores to anon;
