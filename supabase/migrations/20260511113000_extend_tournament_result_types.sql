alter table public.tournament_results
  drop constraint if exists tournament_results_result_type_check;

alter table public.tournament_results
  add constraint tournament_results_result_type_check
  check (result_type in ('sweden_match', 'group', 'podium', 'statistics', 'tie_breaker'));
