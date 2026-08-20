-- Follow-up to Crew Special Blocks: bulk-sync only the scalar scores the award
-- finalizer is allowed to see, and make the mixed-tower support trigger's
-- DELETE return path explicit.

create or replace function public.sync_crew_award_metrics(
  p_crew_id uuid,
  p_metrics jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_updated integer := 0;
  v_rows integer;
  v_item jsonb;
  v_local_run_id text;
  v_zone2 numeric;
  v_target numeric;
  v_level_up numeric;
  v_steady numeric;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  if not public.is_crew_member(p_crew_id) then raise exception 'crew_membership_required'; end if;
  if p_metrics is null or jsonb_typeof(p_metrics) <> 'array' then
    raise exception 'crew_award_metrics_invalid';
  end if;

  for v_item in select value from jsonb_array_elements(p_metrics) loop
    v_local_run_id := nullif(trim(v_item->>'localRunId'), '');
    if v_local_run_id is null then continue; end if;

    v_zone2 := case when v_item ? 'zone2Percent' and jsonb_typeof(v_item->'zone2Percent') = 'number'
      then (v_item->>'zone2Percent')::numeric else null end;
    v_target := case when v_item ? 'targetPercent' and jsonb_typeof(v_item->'targetPercent') = 'number'
      then (v_item->>'targetPercent')::numeric else null end;
    v_level_up := case when v_item ? 'levelUpPercent' and jsonb_typeof(v_item->'levelUpPercent') = 'number'
      then (v_item->>'levelUpPercent')::numeric else null end;
    v_steady := case when v_item ? 'steadySeconds' and jsonb_typeof(v_item->'steadySeconds') = 'number'
      then (v_item->>'steadySeconds')::numeric else null end;

    if v_zone2 is not null and (v_zone2 < 0 or v_zone2 > 100) then
      raise exception 'crew_award_metrics_invalid';
    end if;
    if v_target is not null and (v_target < 0 or v_target > 100) then
      raise exception 'crew_award_metrics_invalid';
    end if;
    if v_level_up is not null and (v_level_up < 0 or v_level_up > 100) then
      raise exception 'crew_award_metrics_invalid';
    end if;
    if v_steady is not null and v_steady < 0 then
      raise exception 'crew_award_metrics_invalid';
    end if;

    update public.shared_runs
    set award_zone2_percent = v_zone2,
        award_target_percent = v_target,
        award_level_up_percent = v_level_up,
        award_steady_seconds = v_steady
    where crew_id = p_crew_id
      and user_id = v_user_id
      and local_run_id = v_local_run_id;
    get diagnostics v_rows = row_count;
    v_updated := v_updated + v_rows;
  end loop;

  return v_updated;
end;
$$;

revoke all on function public.sync_crew_award_metrics(uuid, jsonb) from public, anon;
grant execute on function public.sync_crew_award_metrics(uuid, jsonb) to authenticated;

create or replace function public.repair_crew_build_support_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_crew_id uuid;
begin
  if pg_trigger_depth() > 1 then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    v_crew_id := old.crew_id;
    perform public.repair_crew_build_support(v_crew_id);
    return old;
  end if;

  v_crew_id := new.crew_id;
  perform public.repair_crew_build_support(v_crew_id);
  return new;
end;
$$;
