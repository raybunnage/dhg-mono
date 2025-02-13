-- Create sources_google table and related functions
-- depends on: auth

-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- Create updated_at trigger function if it doesn't exist
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

-- Create the sources_google table
create table if not exists public.sources_google (
  id uuid default uuid_generate_v4() primary key,
  drive_id text not null unique,
  name text not null,
  mime_type text not null,
  web_view_link text,
  parent_folder_id text references public.sources_google(drive_id),
  is_root boolean default false,
  path text[],
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  last_indexed timestamp with time zone,
  metadata jsonb
);

-- Create indexes
create index if not exists sources_google_path_idx 
  on public.sources_google using gin (path);

create index if not exists sources_google_parent_idx 
  on public.sources_google (parent_folder_id);

create index if not exists sources_google_mime_type_idx 
  on public.sources_google (mime_type);

-- Enable RLS
alter table public.sources_google enable row level security;

-- Create policies
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where tablename = 'sources_google' 
    and policyname = 'Enable read access for all authenticated users'
  ) then
    create policy "Enable read access for all authenticated users"
      on public.sources_google
      for select
      using (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies 
    where tablename = 'sources_google' 
    and policyname = 'Enable insert for authenticated users'
  ) then
    create policy "Enable insert for authenticated users"
      on public.sources_google
      for insert
      with check (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies 
    where tablename = 'sources_google' 
    and policyname = 'Enable update for authenticated users'
  ) then
    create policy "Enable update for authenticated users"
      on public.sources_google
      for update
      using (auth.role() = 'authenticated');
  end if;
end $$;

-- Create trigger for updated_at
do $$
begin
  if not exists (
    select 1 from pg_trigger 
    where tgname = 'handle_sources_google_updated_at'
  ) then
    create trigger handle_sources_google_updated_at
      before update
      on public.sources_google
      for each row
      execute function public.handle_updated_at();
  end if;
end $$;

-- Grant permissions
grant usage on schema public to anon, authenticated;
grant all on public.sources_google to anon, authenticated; 