drop policy if exists "Allow anonymous participant inserts" on public.participants;
drop policy if exists "Allow anonymous prediction inserts" on public.predictions;

create policy "Allow anonymous participant inserts"
on public.participants
for insert
to anon
with check (now() <= '2026-06-11 22:00:00+02'::timestamptz);

create policy "Allow anonymous prediction inserts"
on public.predictions
for insert
to anon
with check (now() <= '2026-06-11 22:00:00+02'::timestamptz);
