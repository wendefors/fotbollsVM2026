alter table public.message_board_posts
  drop constraint message_board_posts_display_name_check;

alter table public.message_board_posts
  add constraint message_board_posts_display_name_check
  check (char_length(trim(display_name)) <= 40);

drop policy "Allow anonymous message inserts"
on public.message_board_posts;

create policy "Allow anonymous message inserts"
on public.message_board_posts
for insert
to anon
with check (
  is_hidden = false
  and char_length(trim(display_name)) <= 40
  and char_length(trim(message)) between 1 and 300
);
