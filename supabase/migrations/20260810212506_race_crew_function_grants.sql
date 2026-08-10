-- Supabase projects may grant new public-schema functions to anon/authenticated
-- through default privileges. Keep only the deliberate Race Crew RPC surface.

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

revoke all on function public.is_crew_member(uuid) from public, anon;
revoke all on function public.is_crew_owner(uuid) from public, anon;
revoke all on function public.shares_crew_with(uuid) from public, anon;
grant execute on function public.is_crew_member(uuid) to authenticated;
grant execute on function public.is_crew_owner(uuid) to authenticated;
grant execute on function public.shares_crew_with(uuid) to authenticated;

revoke all on function public.create_crew(text, text, date, numeric) from public, anon;
revoke all on function public.create_crew_invite(uuid, text, timestamptz) from public, anon;
revoke all on function public.redeem_crew_invite(text) from public, anon;
revoke all on function public.revoke_crew_invite(uuid) from public, anon;
revoke all on function public.leave_crew(uuid) from public, anon;
revoke all on function public.remove_crew_member(uuid, uuid) from public, anon;
grant execute on function public.create_crew(text, text, date, numeric) to authenticated;
grant execute on function public.create_crew_invite(uuid, text, timestamptz) to authenticated;
grant execute on function public.redeem_crew_invite(text) to authenticated;
grant execute on function public.revoke_crew_invite(uuid) to authenticated;
grant execute on function public.leave_crew(uuid) to authenticated;
grant execute on function public.remove_crew_member(uuid, uuid) to authenticated;

revoke all on function public.preview_crew_invite(text) from public;
grant execute on function public.preview_crew_invite(text) to anon, authenticated;
