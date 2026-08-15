-- The three-layer Crew Emblem, replacing the four-part Crown/Core/Base/Frame.
--
-- This is a clean replacement rather than a format migration. The old library
-- is gone: its shape indices no longer point at anything, so translating an
-- `E1-` code into the nearest new pieces would be inventing a decision the
-- crew never made. Legacy codes are cleared instead, and an unset crew gets
-- the new system's neutral default until its owner designs a new mark.
--
-- Earlier migrations remain immutable; the constraint is replaced in place
-- under its existing name so nothing downstream has to learn a second one.

alter table public.crews drop constraint if exists crews_emblem_check;

-- Retire every four-part code. `update` runs before the new constraint exists,
-- because an `E1-` value cannot satisfy it.
update public.crews
  set emblem = null
  where emblem is not null
    and emblem !~ '^E2-[0-9]{1,3}\.[0-9]{1,2}-[0-9]{1,3}\.[0-9]{1,2}-[0-9]{1,3}\.[0-9]{1,2}$';

alter table public.crews
  add constraint crews_emblem_check
  check (emblem is null or emblem ~ '^E2-[0-9]{1,3}\.[0-9]{1,2}-[0-9]{1,3}\.[0-9]{1,2}-[0-9]{1,3}\.[0-9]{1,2}$');

-- Three digits of shape index on purpose: the new libraries are meant to grow,
-- and a crew saving a mark this database has never heard of is a client
-- concern (it fails soft to that layer's first option), not a constraint one.
comment on column public.crews.emblem is
  'Crew emblem code: E2-<main>-<secondary>-<background>, each shape.color. Null means the crew has not designed one and the client draws the neutral default.';
