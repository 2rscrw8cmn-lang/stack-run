-- A second Crew Emblem accent.
--
-- The emblem code grows at its end rather than in its middle: the first three
-- layer positions are where already-saved emblems keep their layers, so the
-- new accent is appended after the ink style and everything before it keeps
-- meaning exactly what it meant. Every group past the third stays optional,
-- which is what makes each generation of saved code still readable — no style
-- group is the inked emblem that crew designed, no second accent is the one
-- accent they chose.
--
-- Nothing is rewritten here; only the constraint widens.

alter table public.crews drop constraint if exists crews_emblem_check;

alter table public.crews
  add constraint crews_emblem_check
  check (
    emblem is null
    or emblem ~ '^E2-[0-9]{1,3}\.[0-9]{1,2}-[0-9]{1,3}\.[0-9]{1,2}-[0-9]{1,3}\.[0-9]{1,2}(-[0-9]{1,2}(-[0-9]{1,3}\.[0-9]{1,2})?)?$'
  );

comment on column public.crews.emblem is
  'Crew emblem code: E2-<main>-<secondary>-<background>-<style>-<secondaryTwo>, each layer shape.color and style 0=outlined/1=clean. Groups after the third are optional and absent means outlined / no second accent. Null means the crew has not designed one and the client draws the neutral default.';
