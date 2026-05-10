alter table public.predictions
  add column tournament_questions jsonb not null default '{}'::jsonb,
  add column tie_breaker jsonb not null default '{}'::jsonb;

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
  predictions.points,
  predictions.created_at
from public.predictions
join public.participants on participants.id = predictions.participant_id;

grant select on public.public_predictions to anon;
