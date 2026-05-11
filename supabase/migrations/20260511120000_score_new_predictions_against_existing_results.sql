create or replace function public.to_numeric_or_null(value jsonb)
returns numeric
language sql
immutable
as $$
  select case
    when value is null or value = 'null'::jsonb or value #>> '{}' = '' then null
    else (value #>> '{}')::numeric
  end;
$$;

create or replace function public.match_sign(home_goals numeric, away_goals numeric)
returns text
language sql
immutable
as $$
  select case
    when home_goals > away_goals then '1'
    when home_goals < away_goals then '2'
    else 'X'
  end;
$$;

create or replace function public.calculate_sweden_points(prediction_payload jsonb)
returns integer
language plpgsql
stable
as $$
declare
  prediction_match jsonb;
  result_match jsonb;
  predicted_home numeric;
  predicted_away numeric;
  actual_home numeric;
  actual_away numeric;
  points integer := 0;
begin
  for prediction_match in select * from jsonb_array_elements(coalesce(prediction_payload, '[]'::jsonb))
  loop
    select result_payload
    into result_match
    from public.tournament_results
    where result_type = 'sweden_match'
      and result_key = prediction_match ->> 'id';

    predicted_home := public.to_numeric_or_null(prediction_match -> 'homeGoals');
    predicted_away := public.to_numeric_or_null(prediction_match -> 'awayGoals');
    actual_home := public.to_numeric_or_null(result_match -> 'homeGoals');
    actual_away := public.to_numeric_or_null(result_match -> 'awayGoals');

    if predicted_home is null
      or predicted_away is null
      or actual_home is null
      or actual_away is null
    then
      continue;
    end if;

    if predicted_home = actual_home and predicted_away = actual_away then
      points := points + 3;
    elsif public.match_sign(predicted_home, predicted_away) = public.match_sign(actual_home, actual_away) then
      points := points + 1;
    end if;
  end loop;

  return points;
end;
$$;

create or replace function public.calculate_group_points(prediction_payload jsonb)
returns integer
language plpgsql
stable
as $$
declare
  prediction_group jsonb;
  result_group jsonb;
  points integer := 0;
begin
  for prediction_group in select * from jsonb_array_elements(coalesce(prediction_payload, '[]'::jsonb))
  loop
    select result_payload
    into result_group
    from public.tournament_results
    where result_type = 'group'
      and result_key = prediction_group ->> 'group';

    if result_group is null
      or coalesce(result_group ->> 'winner', '') = ''
      or coalesce(result_group ->> 'runnerUp', '') = ''
    then
      continue;
    end if;

    if prediction_group ->> 'winner' = result_group ->> 'winner' then
      points := points + 1;
    end if;

    if prediction_group ->> 'runnerUp' = result_group ->> 'runnerUp' then
      points := points + 1;
    end if;

    if prediction_group ->> 'winner' = result_group ->> 'runnerUp'
      and prediction_group ->> 'runnerUp' = result_group ->> 'winner'
    then
      points := points + 1;
    end if;
  end loop;

  return points;
end;
$$;

create or replace function public.calculate_podium_points(prediction_payload jsonb)
returns integer
language plpgsql
stable
as $$
declare
  result_podium jsonb;
  points integer := 0;
begin
  select result_payload
  into result_podium
  from public.tournament_results
  where result_type = 'podium'
    and result_key = 'final';

  if result_podium is null then
    return 0;
  end if;

  if coalesce(prediction_payload ->> 'champion', '') <> ''
    and prediction_payload ->> 'champion' = result_podium ->> 'champion'
  then
    points := points + 5;
  end if;

  if coalesce(prediction_payload ->> 'runnerUp', '') <> ''
    and prediction_payload ->> 'runnerUp' = result_podium ->> 'runnerUp'
  then
    points := points + 3;
  end if;

  if coalesce(prediction_payload ->> 'thirdPlace', '') <> ''
    and prediction_payload ->> 'thirdPlace' = result_podium ->> 'thirdPlace'
  then
    points := points + 2;
  end if;

  return points;
end;
$$;

create or replace function public.percentage_stat_points(predicted numeric, actual numeric)
returns integer
language sql
immutable
as $$
  select case
    when predicted is null or actual is null or actual = 0 then 0
    when abs(predicted - actual) / actual * 100 <= 3 then 3
    when abs(predicted - actual) / actual * 100 <= 5 then 2
    when abs(predicted - actual) / actual * 100 <= 10 then 1
    else 0
  end;
$$;

create or replace function public.red_card_stat_points(predicted numeric, actual numeric)
returns integer
language sql
immutable
as $$
  select case
    when predicted is null or actual is null then 0
    when abs(predicted - actual) <= 1 then 3
    when abs(predicted - actual) <= 2 then 2
    when abs(predicted - actual) <= 3 then 1
    else 0
  end;
$$;

create or replace function public.calculate_statistics_points(prediction_payload jsonb)
returns integer
language plpgsql
stable
as $$
declare
  result_statistics jsonb;
begin
  select result_payload
  into result_statistics
  from public.tournament_results
  where result_type = 'statistics'
    and result_key = 'totals';

  if result_statistics is null
    or coalesce((result_statistics ->> 'isFinal')::boolean, false) is false
  then
    return 0;
  end if;

  return
    public.percentage_stat_points(
      public.to_numeric_or_null(prediction_payload -> 'yellowCards'),
      public.to_numeric_or_null(result_statistics -> 'yellowCards')
    )
    + public.red_card_stat_points(
      public.to_numeric_or_null(prediction_payload -> 'redCards'),
      public.to_numeric_or_null(result_statistics -> 'redCards')
    )
    + public.percentage_stat_points(
      public.to_numeric_or_null(prediction_payload -> 'totalGoals'),
      public.to_numeric_or_null(result_statistics -> 'totalGoals')
    );
end;
$$;

create or replace function public.calculate_tie_breaker_distance(prediction_payload jsonb)
returns integer
language plpgsql
stable
as $$
declare
  result_tie_breaker jsonb;
  predicted_minute numeric;
  actual_minute numeric;
begin
  select result_payload
  into result_tie_breaker
  from public.tournament_results
  where result_type = 'tie_breaker'
    and result_key = 'final_first_goal';

  predicted_minute := public.to_numeric_or_null(prediction_payload -> 'finalFirstGoalMinute');
  actual_minute := public.to_numeric_or_null(result_tie_breaker -> 'finalFirstGoalMinute');

  if predicted_minute is null or actual_minute is null then
    return null;
  end if;

  return abs(predicted_minute - actual_minute)::integer;
end;
$$;

create or replace function public.create_prediction_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.prediction_scores (
    prediction_id,
    sweden_points,
    group_points,
    podium_points,
    statistics_points,
    tie_breaker_distance,
    updated_at
  )
  values (
    new.id,
    public.calculate_sweden_points(new.sweden_matches),
    public.calculate_group_points(new.group_predictions),
    public.calculate_podium_points(new.podium),
    public.calculate_statistics_points(new.tournament_questions),
    public.calculate_tie_breaker_distance(new.tie_breaker),
    now()
  )
  on conflict (prediction_id) do update
    set sweden_points = excluded.sweden_points,
        group_points = excluded.group_points,
        podium_points = excluded.podium_points,
        statistics_points = excluded.statistics_points,
        tie_breaker_distance = excluded.tie_breaker_distance,
        updated_at = now();

  return new;
end;
$$;
