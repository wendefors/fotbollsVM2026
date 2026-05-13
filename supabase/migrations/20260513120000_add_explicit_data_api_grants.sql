-- Make Data API access explicit ahead of Supabase's public schema grant changes.

grant select
  on public.public_predictions
  to anon;

grant select
  on public.tournament_results
  to anon;

grant execute
  on function public.submit_prediction(jsonb, jsonb)
  to anon;

grant select, insert, update, delete
  on public.tournament_results
  to service_role;

grant select, insert, update, delete
  on public.predictions
  to service_role;

grant select, insert, update, delete
  on public.prediction_scores
  to service_role;
