-- Revert sources_google table and related objects

do $$ 
begin
  -- Drop policies if they exist
  if exists (
    select 1 from pg_policies 
    where tablename = 'sources_google' 
    and schemaname = 'public'
  ) then
    drop policy if exists "Enable read access for all authenticated users" on public.sources_google;
    drop policy if exists "Enable insert for authenticated users" on public.sources_google;
    drop policy if exists "Enable update for authenticated users" on public.sources_google;
  end if;

  -- Drop trigger if it exists
  if exists (
    select 1 from pg_trigger 
    where tgname = 'handle_sources_google_updated_at'
  ) then
    drop trigger if exists handle_sources_google_updated_at on public.sources_google;
  end if;

  -- Drop table if it exists
  drop table if exists public.sources_google;
end $$;

-- Note: We don't drop the handle_updated_at function as it might be used by other tables 