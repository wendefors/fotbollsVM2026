delete from public.participants
where email in (
  'test@example.com',
  'test-minimal@example.com',
  'test-flode@example.com'
);
