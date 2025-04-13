-- Create presentations table
create table presentations (
  id uuid primary key default uuid_generate_v4(),
  filename text not null,
  folder_path text not null,
  title text,
  duration interval,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  transcript text,
  transcript_status text default 'pending' check (transcript_status in ('pending', 'processing', 'completed', 'failed')),
  metadata jsonb default '{}'::jsonb,
  
  -- Add constraints
  constraint valid_folder_path check (folder_path ~ '^/'),
  constraint valid_filename check (filename ~ '\.mp4$')
);

-- Add presentation_id to sources_google
alter table sources_google 
add column presentation_id uuid references presentations(id);

-- Create index for faster lookups
create index idx_sources_google_presentation_id on sources_google(presentation_id);
create index idx_presentations_folder_path on presentations(folder_path);

-- Add trigger to update updated_at
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_presentations_updated_at
  before update on presentations
  for each row
  execute function update_updated_at_column();

-- Add helpful comments
comment on table presentations is 'Stores information about presentation videos (MP4s) and their transcripts';
comment on column presentations.folder_path is 'Full path to the folder containing the MP4, starting with /';
comment on column presentations.transcript_status is 'Status of transcript processing: pending, processing, completed, or failed';
comment on column presentations.metadata is 'Additional metadata about the presentation in JSONB format';
comment on column sources_google.presentation_id is 'Reference to the presentation video associated with this source'; 