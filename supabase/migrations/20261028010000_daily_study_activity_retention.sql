drop policy if exists "Users can delete their own daily study activity"
  on public.study_activity_daily;

create policy "Users can delete their own daily study activity"
  on public.study_activity_daily for delete to authenticated
  using ((select auth.uid()) = user_id);

grant delete on public.study_activity_daily to authenticated;
