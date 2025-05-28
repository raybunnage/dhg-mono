-- Create google_sources table and related functions
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

-- Create the google_sources table
create table if not exists public.google_sources (
  id uuid default uuid_generate_v4() primary key,
  drive_id text not null unique,
  name text not null,
  mime_type text not null,
  web_view_link text,
  parent_folder_id text references public.google_sources(drive_id),
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
create index if not exists google_sources_path_idx 
  on public.google_sources using gin (path);

create index if not exists google_sources_parent_idx 
  on public.google_sources (parent_folder_id);

create index if not exists google_sources_mime_type_idx 
  on public.google_sources (mime_type);

-- Enable RLS
alter table public.google_sources enable row level security;

-- Create policies
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where tablename = 'google_sources' 
    and policyname = 'Enable read access for all authenticated users'
  ) then
    create policy "Enable read access for all authenticated users"
      on public.google_sources
      for select
      using (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies 
    where tablename = 'google_sources' 
    and policyname = 'Enable insert for authenticated users'
  ) then
    create policy "Enable insert for authenticated users"
      on public.google_sources
      for insert
      with check (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies 
    where tablename = 'google_sources' 
    and policyname = 'Enable update for authenticated users'
  ) then
    create policy "Enable update for authenticated users"
      on public.google_sources
      for update
      using (auth.role() = 'authenticated');
  end if;
end $$;

-- Create trigger for updated_at
do $$
begin
  if not exists (
    select 1 from pg_trigger 
    where tgname = 'handle_google_sources_updated_at'
  ) then
    create trigger handle_google_sources_updated_at
      before update
      on public.google_sources
      for each row
      execute function public.handle_updated_at();
  end if;
end $$;

-- Grant permissions
grant usage on schema public to anon, authenticated;
grant all on public.google_sources to anon, authenticated; 