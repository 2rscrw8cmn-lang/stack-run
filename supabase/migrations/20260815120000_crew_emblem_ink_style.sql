-- The Crew Emblem's ink style: outlined, or flat colour.
--
-- A crew can now turn the ink outline off on the two foreground layers, and
-- that is a design decision rather than a rendering preference, so it rides
-- along in the stored code as a trailing style group.
--
-- The group is optional. Codes saved between the three-layer rebuild and this
-- change have no style digit and mean the inked emblem their crews designed,
-- so nothing is rewritten here — only the constraint widens.

alter table public.crews drop constraint if exists crews_emblem_check;

alter table public.crews
  add constraint crews_emblem_check
  check (
    emblem is null
    or emblem ~ '^E2-[0-9]{1,3}\.[0-9]{1,2}-[0-9]{1,3}\.[0-9]{1,2}-[0-9]{1,3}\.[0-9]{1,2}(-[0-9]{1,2})?$'
  );

-- Two digits of style on purpose, for the same reason shape indices get three:
-- a style this database has never heard of is a client concern (it fails soft
-- to the inked default), not a constraint one.
comment on column public.crews.emblem is
  'Crew emblem code: E2-<main>-<secondary>-<background>-<style>, each layer shape.color and style 0=outlined/1=clean. The style group is optional and absent means outlined. Null means the crew has not designed one and the client draws the neutral default.';
