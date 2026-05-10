alter table public.participants
  alter column first_name drop not null,
  alter column last_name drop not null,
  alter column phone drop not null,
  alter column email drop not null;
