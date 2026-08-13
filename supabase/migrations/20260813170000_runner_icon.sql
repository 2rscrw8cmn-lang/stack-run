-- Runner Icons: the personal mark a runner wears across Crew.
--
-- One icon per account, not one per crew — a runner is the same person in
-- every crew they join, so this belongs on `profiles` beside display name and
-- accent color rather than on `crew_members`.
--
-- Only approved option identifiers are stored. The column is a short opaque
-- code, never user-supplied SVG, and the check constraint is the same pattern
-- the client encodes with.

alter table public.profiles
  add column if not exists runner_icon text
  check (runner_icon is null or runner_icon ~ '^R1-[0-9]{1,2}\.[0-9]{1,2}\.[0-9]{1,2}\.[0-9]{1,2}$');

comment on column public.profiles.runner_icon is
  'Runner Icon code: R1-<head>.<face>.<body>.<extra>, indices into the client part library. Null means the client draws the user id''s stable derived mark. Color is deliberately absent: a runner''s icon color is profiles.accent_color, so icon and Crew Build ownership can never disagree.';

-- Null stays null on purpose. An account created before Runner Icons existed
-- keeps rendering: the client derives a stable per-user icon from the same
-- library until the runner saves one in Settings. Nothing is backfilled, and
-- no crew flow is blocked on having an icon.
--
-- No new policy is needed. `profiles` is already readable by crewmates under
-- the UI-18 select policy and writable only by its owner, and an icon is
-- exactly as sensitive as the display name sitting next to it.
