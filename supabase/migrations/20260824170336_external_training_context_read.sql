-- Evolution 2.10A: a provider-neutral, read-only snapshot of the authenticated
-- runner's canonical cloud state. External auth and transport are deliberately
-- deferred; this function accepts no subject/user id and runs as the caller so
-- the existing personal and Crew RLS policies remain authoritative.

create or replace function public.read_external_training_context(
  p_as_of_date date default current_date
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'authentication_required';
  end if;

  return (
    with training as (
      select plan
      from public.personal_training_state
      where user_id = v_user_id
    ),
    build as (
      select placements
      from public.personal_build_state
      where user_id = v_user_id
    ),
    future_workouts as (
      select workout
      from training
      cross join lateral jsonb_array_elements(
        case
          when jsonb_typeof(plan -> 'weeks') = 'array' then plan -> 'weeks'
          else '[]'::jsonb
        end
      ) as week(value)
      cross join lateral jsonb_array_elements(
        case
          when jsonb_typeof(week.value -> 'workouts') = 'array'
            then week.value -> 'workouts'
          else '[]'::jsonb
        end
      ) as item(workout)
      where plan is not null
        and item.workout ->> 'date' >= p_as_of_date::text
    ),
    recent_runs as (
      select run.*
      from public.personal_runs as run
      where run.user_id = v_user_id
        and run.deleted_at is null
        and run.completed_date between p_as_of_date - 89 and p_as_of_date
      order by run.completed_date desc, run.run_id
      limit 100
    ),
    run_context as (
      select jsonb_build_object(
        'id', 'run-log:' || run.run_id,
        'date', run.completed_date::text,
        'activityKind', case
          when run.activity_type = 'cross' then 'cross-training'
          else 'running'
        end,
        'activityType', run.activity_type,
        'distanceMiles', run.distance_miles,
        'durationSeconds', run.duration_seconds,
        'paceSecondsPerMile', case
          when run.distance_miles > 0
            then run.duration_seconds / run.distance_miles
          else null
        end,
        'source', run.source,
        'origin', 'stack-run-log',
        'historicalReconciliationStatus', 'not-observable-from-account-cloud',
        'planRelationship', jsonb_build_object(
          'status', case when run.workout_id is null then 'extra' else 'linked' end,
          'workoutId', run.workout_id
        ),
        'build', jsonb_build_object(
          'status', case
            when exists (
              select 1
              from build
              cross join lateral jsonb_array_elements(
                case
                  when jsonb_typeof(build.placements) = 'array' then build.placements
                  else '[]'::jsonb
                end
              ) as placement(value)
              where placement.value ->> 'runLogId' = run.run_id
            ) then 'placed'
            else 'earned-unplaced'
          end
        ),
        'metrics', jsonb_build_object(
          'averageHeartRateBpm', case
            when jsonb_typeof(run.imported_metrics -> 'averageHeartRate') = 'number'
              then run.imported_metrics -> 'averageHeartRate'
            when run.manual_heart_rate is not null then to_jsonb(run.manual_heart_rate)
            else null
          end,
          'maxHeartRateBpm', case
            when jsonb_typeof(run.imported_metrics -> 'maxHeartRate') = 'number'
              then run.imported_metrics -> 'maxHeartRate'
            else null
          end,
          'heartRateProvenance', case
            when jsonb_typeof(run.imported_metrics -> 'averageHeartRate') = 'number'
              then 'source-aggregate'
            when run.manual_heart_rate is not null then 'runner-entered'
            else 'missing'
          end,
          'averageCadence', case
            when jsonb_typeof(run.imported_metrics -> 'averageCadence') = 'number'
              then run.imported_metrics -> 'averageCadence'
            else null
          end,
          'elevationGainFeet', case
            when jsonb_typeof(run.imported_metrics -> 'elevationGainFeet') = 'number'
              then run.imported_metrics -> 'elevationGainFeet'
            else null
          end,
          'trainingLoad', case
            when jsonb_typeof(run.imported_metrics -> 'trainingLoad') = 'number'
              then run.imported_metrics -> 'trainingLoad'
            else null
          end,
          'hrZoneSeconds', case
            when jsonb_typeof(run.imported_metrics -> 'hrZoneSeconds') = 'array'
              and not exists (
                select 1
                from jsonb_array_elements(run.imported_metrics -> 'hrZoneSeconds') as zone(value)
                where jsonb_typeof(zone.value) <> 'number'
              ) then run.imported_metrics -> 'hrZoneSeconds'
            else null
          end
        ),
        'crewContributions', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'crewId', shared.crew_id::text,
              'memberBuildStatus', case
                when shared.build_row is null then 'not-placed'
                else 'placed'
              end,
              'crewBuildStatus', case
                when shared.crew_build_row is null then 'ready'
                else 'placed'
              end
            )
            order by shared.crew_id
          )
          from public.shared_runs as shared
          where shared.user_id = v_user_id
            and shared.local_run_id = run.run_id
        ), '[]'::jsonb)
      ) as value,
      run.completed_date,
      run.run_id
      from recent_runs as run
    )
    select jsonb_build_object(
      'schemaVersion', 1,
      'subject', 'authenticated-user',
      'asOfDate', p_as_of_date::text,
      'accountStatus', case
        when exists (select 1 from training) then 'initialized'
        else 'not-initialized'
      end,
      'plan', case
        when not exists (select 1 from training) then jsonb_build_object(
          'status', 'account-not-initialized',
          'activePlan', null,
          'currentAndFutureWorkouts', '[]'::jsonb
        )
        when (select plan from training) is null then jsonb_build_object(
          'status', 'no-active-plan',
          'activePlan', null,
          'currentAndFutureWorkouts', '[]'::jsonb
        )
        else jsonb_build_object(
          'status', 'active',
          'activePlan', jsonb_build_object(
            'id', (select plan ->> 'id' from training),
            'name', (select plan ->> 'name' from training),
            'startDate', (select plan ->> 'startDate' from training),
            'endDate', (select plan ->> 'endDate' from training),
            'race', jsonb_build_object(
              'name', (select plan -> 'race' ->> 'name' from training),
              'date', (select plan -> 'race' ->> 'date' from training),
              'distanceMiles', (select plan -> 'race' -> 'distanceMiles' from training)
            )
          ),
          'currentAndFutureWorkouts', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', workout ->> 'id',
                'date', workout ->> 'date',
                'weekNumber', workout -> 'weekNumber',
                'phase', workout ->> 'phase',
                'type', workout ->> 'type',
                'title', workout ->> 'title',
                'targetDistanceMiles', workout -> 'targetDistanceMiles',
                'details', workout ->> 'details'
              )
              order by workout ->> 'date', workout ->> 'id'
            )
            from future_workouts
          ), '[]'::jsonb)
        )
      end,
      'recentHistory', jsonb_build_object(
        'status', case
          when exists (select 1 from run_context) then 'available'
          else 'empty'
        end,
        'coverage', jsonb_build_object(
          'status', 'partial',
          'windowStart', (p_as_of_date - 89)::text,
          'windowEnd', p_as_of_date::text,
          'recordLimit', 100,
          'truncated', (
            select count(*) > 100
            from public.personal_runs as counted
            where counted.user_id = v_user_id
              and counted.deleted_at is null
              and counted.completed_date between p_as_of_date - 89 and p_as_of_date
          ),
          'includedOrigins', jsonb_build_array('stack-run-log'),
          'historicalSourceMirrorIncluded', false,
          'reason', 'Source-only historical activities remain device-local and are not available to this account-cloud read.'
        ),
        'runs', coalesce((
          select jsonb_agg(value order by completed_date desc, run_id)
          from run_context
        ), '[]'::jsonb)
      ),
      'planAdjustmentHistory', jsonb_build_object(
        'status', 'not-available',
        'entries', '[]'::jsonb
      )
    )
  );
end;
$$;

comment on function public.read_external_training_context(date) is
  'Read-only provider-neutral training context for auth.uid(); accepts no subject user id.';

revoke all on function public.read_external_training_context(date) from public, anon;
grant execute on function public.read_external_training_context(date) to authenticated;
