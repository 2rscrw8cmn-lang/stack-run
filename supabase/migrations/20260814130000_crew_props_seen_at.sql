-- UI-22 Props notifications: a runner learns when a teammate propped their
-- run. No new table — "unread" is just Props newer than the last time the
-- runner opened a surface that shows them, so this is one column.

alter table public.profiles
  add column props_seen_at timestamptz not null default now();
