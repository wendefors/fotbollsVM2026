# Data Safety Rules

Production or shared Supabase data must be treated as user-owned data.

## Hard Rules

- Do not run `delete`, `truncate`, `drop table`, or destructive update statements against user data from migrations.
- Do not delete data based on an assumed id type. Verify whether an id belongs to `predictions`, `participants`, or another table before any action.
- Do not perform destructive data cleanup in the same step as discovery.
- Do not proceed if the row that should be kept cannot be verified first.
- Prefer disabling, hiding, or archiving records over deleting them.

## Required Cleanup Process

Before any cleanup:

1. Run a read-only query that lists all candidate rows.
2. Run a read-only query that proves every row to keep exists.
3. Share the exact candidate list and keep list with the user.
4. Wait for explicit confirmation after the user has seen the list.
5. Create a backup/export or an archive table before changing data.
6. Run the smallest possible change inside a transaction.
7. Verify the final state with a read-only query.

## Preferred Pattern

If test submissions need to be hidden, add a non-destructive flag such as `is_test`,
`archived_at`, or `deleted_at` and filter those rows out of public views.

Physical deletion should be exceptional and must have a verified backup first.
