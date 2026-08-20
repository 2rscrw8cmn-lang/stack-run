-- Award scalars ride the ordinary projection upload.
--
-- award_zone2_percent, award_target_percent and award_level_up_percent were
-- published only by sync_crew_award_metrics(), which the client called from the
-- Crew screen. A runner who logged runs all week but never opened the Crew tab
-- therefore had null scores when the week closed, and finalize_crew_awards()
-- freezes its answer -- so Zone 2, On Target and Level Up went to whoever
-- opened Crew before the first finalization rather than to whoever won them.
--
-- syncCrewProjection() now writes them alongside distance, duration and heart
-- rate. That upload happens whenever a runner's own state changes, so the
-- scores are in place before any week closes.
--
-- Table-level insert on shared_runs was already ungated by column
-- (20260813150000); only update is column-scoped, so this adds to that grant
-- the same way 20260818150000 added the heart-rate columns. GRANT is additive,
-- not a replacement.
--
-- Writing these directly is not a widening of who may write what: RLS policy
-- shared_runs_update_self still restricts a runner to rows where
-- user_id = auth.uid(), exactly as the RPC did, and the 0-100 / non-negative
-- CHECK constraints from 20260819025500 bound the values on every path.
--
-- sync_crew_award_metrics() is deliberately left in place. A tab opened before
-- this deploy still calls it, and it remains correct; it simply stops being the
-- only way these columns are written.

grant update (
  award_zone2_percent,
  award_target_percent,
  award_level_up_percent,
  award_steady_seconds
) on public.shared_runs to authenticated;
