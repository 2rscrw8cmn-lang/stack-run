-- Runner Icons gain a fifth part: the backdrop the runner stands on.
--
-- The stored form goes from `R1-<head>.<face>.<body>.<extra>` to
-- `R2-<head>.<face>.<body>.<flair>.<background>`. Both are accepted here on
-- purpose: an account that saved an icon before backdrops existed keeps its
-- four choices and simply has no backdrop, and nothing is rewritten. The
-- client encodes `R2-` from now on, so a row migrates the next time its owner
-- saves an icon — never on a schedule, and never by a backfill that would
-- have to guess at a choice the runner never made.
--
-- Still only approved option identifiers, never user-supplied SVG, and still
-- the same pattern the client encodes with.

alter table public.profiles
  drop constraint if exists profiles_runner_icon_check;

alter table public.profiles
  add constraint profiles_runner_icon_check
  check (
    runner_icon is null
    or runner_icon ~ '^R1-[0-9]{1,2}\.[0-9]{1,2}\.[0-9]{1,2}\.[0-9]{1,2}$'
    or runner_icon ~ '^R2-[0-9]{1,2}\.[0-9]{1,2}\.[0-9]{1,2}\.[0-9]{1,2}\.[0-9]{1,2}$'
  );

comment on column public.profiles.runner_icon is
  'Runner Icon code: R2-<head>.<face>.<body>.<flair>.<background>, indices into the client part library. R1-<head>.<face>.<body>.<extra> codes predate backdrops and still decode, with no backdrop. Null means the client draws the user id''s stable derived mark. Color is deliberately absent: a runner''s icon color is profiles.accent_color, so icon and Crew Build ownership can never disagree.';
