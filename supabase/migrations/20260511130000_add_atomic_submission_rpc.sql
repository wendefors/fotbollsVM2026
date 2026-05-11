create or replace function public.is_required_text(value text)
returns boolean
language sql
immutable
as $$
  select nullif(trim(coalesce(value, '')), '') is not null;
$$;

create or replace function public.is_jsonb_whole_number(value jsonb, minimum numeric default 0)
returns boolean
language sql
immutable
as $$
  select case
    when jsonb_typeof(value) <> 'number' then false
    else (value #>> '{}')::numeric = trunc((value #>> '{}')::numeric)
      and (value #>> '{}')::numeric >= minimum
  end;
$$;

create or replace function public.validate_submission_payload(
  contact_payload jsonb,
  prediction_payload jsonb
)
returns void
language plpgsql
stable
as $$
declare
  item jsonb;
  email_value text := lower(trim(coalesce(contact_payload ->> 'email', '')));
begin
  if now() > '2026-06-11 22:00:00+02'::timestamptz then
    raise exception 'submission is closed' using errcode = 'P0001';
  end if;

  if not public.is_required_text(contact_payload ->> 'firstName')
    or not public.is_required_text(contact_payload ->> 'lastName')
    or not public.is_required_text(contact_payload ->> 'phone')
    or not public.is_required_text(contact_payload ->> 'email')
  then
    raise exception 'missing contact fields' using errcode = 'P0001';
  end if;

  if email_value !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'invalid email' using errcode = 'P0001';
  end if;

  if jsonb_typeof(prediction_payload -> 'swedenMatches') <> 'array'
    or jsonb_array_length(prediction_payload -> 'swedenMatches') <> 3
  then
    raise exception 'invalid sweden matches' using errcode = 'P0001';
  end if;

  for item in select * from jsonb_array_elements(prediction_payload -> 'swedenMatches')
  loop
    if not public.is_required_text(item ->> 'id')
      or not public.is_required_text(item ->> 'homeTeam')
      or not public.is_required_text(item ->> 'awayTeam')
      or not public.is_jsonb_whole_number(item -> 'homeGoals', 0)
      or not public.is_jsonb_whole_number(item -> 'awayGoals', 0)
    then
      raise exception 'invalid sweden match prediction' using errcode = 'P0001';
    end if;
  end loop;

  if jsonb_typeof(prediction_payload -> 'groups') <> 'array'
    or jsonb_array_length(prediction_payload -> 'groups') <> 12
  then
    raise exception 'invalid group predictions' using errcode = 'P0001';
  end if;

  for item in select * from jsonb_array_elements(prediction_payload -> 'groups')
  loop
    if not public.is_required_text(item ->> 'group')
      or not public.is_required_text(item ->> 'winner')
      or not public.is_required_text(item ->> 'runnerUp')
    then
      raise exception 'invalid group prediction' using errcode = 'P0001';
    end if;
  end loop;

  if not public.is_required_text(prediction_payload #>> '{podium,champion}')
    or not public.is_required_text(prediction_payload #>> '{podium,runnerUp}')
    or not public.is_required_text(prediction_payload #>> '{podium,thirdPlace}')
  then
    raise exception 'invalid podium prediction' using errcode = 'P0001';
  end if;

  if not public.is_jsonb_whole_number(prediction_payload #> '{tournamentQuestions,yellowCards}', 0)
    or not public.is_jsonb_whole_number(prediction_payload #> '{tournamentQuestions,redCards}', 0)
    or not public.is_jsonb_whole_number(prediction_payload #> '{tournamentQuestions,totalGoals}', 0)
  then
    raise exception 'invalid tournament questions' using errcode = 'P0001';
  end if;

  if not public.is_jsonb_whole_number(prediction_payload #> '{tieBreaker,finalFirstGoalMinute}', 1) then
    raise exception 'invalid tie breaker' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.submit_prediction(
  contact_payload jsonb,
  prediction_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  participant_id uuid := gen_random_uuid();
  prediction_id uuid := gen_random_uuid();
begin
  perform public.validate_submission_payload(contact_payload, prediction_payload);

  insert into public.participants (
    id,
    first_name,
    last_name,
    phone,
    email
  )
  values (
    participant_id,
    trim(contact_payload ->> 'firstName'),
    trim(contact_payload ->> 'lastName'),
    trim(contact_payload ->> 'phone'),
    lower(trim(contact_payload ->> 'email'))
  );

  insert into public.predictions (
    id,
    participant_id,
    sweden_matches,
    group_predictions,
    podium,
    tournament_questions,
    tie_breaker
  )
  values (
    prediction_id,
    participant_id,
    prediction_payload -> 'swedenMatches',
    prediction_payload -> 'groups',
    prediction_payload -> 'podium',
    prediction_payload -> 'tournamentQuestions',
    prediction_payload -> 'tieBreaker'
  );

  return prediction_id;
end;
$$;

revoke insert on public.participants from anon;
revoke insert on public.predictions from anon;

grant execute on function public.submit_prediction(jsonb, jsonb) to anon;
