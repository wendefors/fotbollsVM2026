create table public.message_board_posts (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (
    char_length(trim(display_name)) between 1 and 40
  ),
  message text not null check (
    char_length(trim(message)) between 1 and 300
  ),
  is_hidden boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.message_board_posts enable row level security;

create policy "Allow anonymous visible message reads"
on public.message_board_posts
for select
to anon
using (is_hidden = false);

create policy "Allow anonymous message inserts"
on public.message_board_posts
for insert
to anon
with check (
  is_hidden = false
  and char_length(trim(display_name)) between 1 and 40
  and char_length(trim(message)) between 1 and 300
);

grant select, insert
  on public.message_board_posts
  to anon;

grant select, insert, update, delete
  on public.message_board_posts
  to service_role;
