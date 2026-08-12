-- Runner-chosen identity color for the Crew Build tower and comparison rows.
-- Replaces the old hash-only accent, which reused activity-type colors and
-- could visually collide with the block fill it was meant to sit apart from.

alter table public.profiles
  add column accent_color text
  check (accent_color is null or accent_color in (
    'green', 'emerald', 'jade', 'mint', 'seafoam', 'aqua', 'turquoise', 'sky',
    'orchid', 'magenta', 'fuchsia', 'raspberry', 'crimson', 'red', 'vermilion', 'rust'
  ));

-- Null means "no explicit pick yet" — the client falls back to a stable
-- per-user hash from the same 16-color set until the runner chooses one in
-- Settings. Only an explicit pick is enforced unique here; two runners who
-- have never opened the picker may share a hash-derived color, which
-- Settings' grey-out already steers them away from once either one opens it.
create or replace function public.enforce_unique_crew_accent_color()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.accent_color is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.accent_color is not distinct from old.accent_color then
    return new;
  end if;

  if exists (
    select 1
    from public.crew_members mine
    join public.crew_members theirs
      on theirs.crew_id = mine.crew_id and theirs.user_id <> mine.user_id
    join public.profiles teammate on teammate.id = theirs.user_id
    where mine.user_id = new.id
      and teammate.accent_color = new.accent_color
  ) then
    raise exception 'That color is already taken by another crew member.';
  end if;

  return new;
end;
$$;

create trigger profiles_enforce_unique_crew_accent_color
before insert or update on public.profiles
for each row execute function public.enforce_unique_crew_accent_color();
