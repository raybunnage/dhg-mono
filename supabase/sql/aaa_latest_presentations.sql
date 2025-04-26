

CREATE TABLE "subject_classifications" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject TEXT NOT NULL,
    subject_character TEXT,
    short_name TEXT,
    associated_concepts TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


   subject_classifications: {
        Row: {
          associated_concepts: string | null
          created_at: string | null
          id: string
          short_name: string | null
          subject: string
          subject_character: string | null
          updated_at: string | null
        }

-- Create a trigger to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_subject_classifications_updated_at
    BEFORE UPDATE ON subject_classifications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


CREATE TABLE "presentations" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT,
    high_level_folder_source_id UUID REFERENCES sources_google(id),  -- Assuming this references a sources_google table
    video_source_id UUID REFERENCES sources_google(id),              -- Assuming this references a sources_google table
    web_view_link TEXT,
    root_drive_id TEXT,
    expert_document_id UUID REFERENCES expert_documents(id),
    expert_id UUID REFERENCES experts(id),
    view_count INTEGER DEFAULT 0,
    duration_seconds INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Add indexes for frequently queried fields and foreign keys
    CONSTRAINT view_count_non_negative CHECK (view_count >= 0),
    CONSTRAINT duration_seconds_non_negative CHECK (duration_seconds >= 0)
);

     presentations: {
        Row: {
          created_at: string | null
          duration_seconds: number | null
          expert_document_id: string | null
          expert_id: string | null
          high_level_folder_source_id: string | null
          id: string
          root_drive_id: string | null
          title: string | null
          updated_at: string | null
          video_source_id: string | null
          view_count: number | null
          web_view_link: string | null
        }

-- Create index for performance on common queries
CREATE INDEX idx_presentations_expert_id ON presentations(expert_id);
CREATE INDEX idx_presentations_expert_document_id ON presentations(expert_document_id);
CREATE INDEX idx_presentations_video_source_id ON presentations(video_source_id);

-- Create trigger for updating the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_presentations_updated_at
    BEFORE UPDATE ON presentations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create a function to increment view count
CREATE OR REPLACE FUNCTION increment_presentation_view_count(presentation_uuid UUID)
RETURNS void AS $$
BEGIN
    UPDATE presentations 
    SET view_count = view_count + 1 
    WHERE id = presentation_uuid;
END;
$$ LANGUAGE plpgsql;


-- Create the presentation_assets table
CREATE TABLE "presentation_assets" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    presentation_id UUID NOT NULL REFERENCES presentations(id) ON DELETE CASCADE,
    asset_source_id UUID REFERENCES sources_google(id),
    asset_expert_document_id UUID REFERENCES expert_documents(id),
    asset_role asset_role_enum,
    asset_type asset_type_enum,
    importance_level INTEGER CHECK (importance_level >= 0 AND importance_level <= 10),
    metadata JSONB,
    timestamp_start INTEGER CHECK (timestamp_start >= 0),
    timestamp_end INTEGER CHECK (timestamp_end >= 0),
    user_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Add constraint to ensure timestamp_end is after timestamp_start
    CONSTRAINT valid_timestamp_range 
        CHECK (timestamp_end IS NULL OR timestamp_start IS NULL OR timestamp_end >= timestamp_start)
);

    presentation_assets: {
        Row: {
          asset_expert_document_id: string | null
          asset_role: Database["public"]["Enums"]["asset_role_enum"] | null
          asset_source_id: string | null
          asset_type: Database["public"]["Enums"]["asset_type_enum"] | null
          created_at: string | null
          id: string
          importance_level: number | null
          metadata: Json | null
          presentation_id: string
          timestamp_end: number | null
          timestamp_start: number | null
          updated_at: string | null
          user_notes: string | null
        }

-- Create indexes for better query performance
CREATE INDEX idx_presentation_assets_presentation_id ON presentation_assets(presentation_id);
CREATE INDEX idx_presentation_assets_asset_source_id ON presentation_assets(asset_source_id);
CREATE INDEX idx_presentation_assets_asset_expert_document_id ON presentation_assets(asset_expert_document_id);
CREATE INDEX idx_presentation_assets_asset_type ON presentation_assets(asset_type);
CREATE INDEX idx_presentation_assets_metadata ON presentation_assets USING gin (metadata);

-- Create trigger for updating the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_presentation_assets_updated_at
    BEFORE UPDATE ON presentation_assets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();






  CREATE TYPE classified_entity_type AS ENUM (
    'expert_documents',
    'documentation_files',
    'sources_google',
    'scripts'
  );


  -- Create the table_classifications junction table
  CREATE TABLE table_classifications (
    id uuid default gen_random_uuid() primary key NOT NULL,
    entity_type classified_entity_type NOT NULL,
    entity_id uuid NOT NULL,
    subject_classification_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    notes text,

    -- Add foreign key constraint to subject_classifications table
    CONSTRAINT fk_subject_classification
      FOREIGN KEY (subject_classification_id)
      REFERENCES subject_classifications(id)
      ON DELETE CASCADE,

    -- Add unique constraint to prevent duplicate classifications
    CONSTRAINT unique_entity_classification
      UNIQUE (entity_type, entity_id, subject_classification_id)
  );

  -- Create indexes for better query performance
  CREATE INDEX idx_table_classifications_entity_id ON table_classifications(entity_id);
  CREATE INDEX idx_table_classifications_subject_classification_id ON
  table_classifications(subject_classification_id);
  CREATE INDEX idx_table_classifications_entity_type ON table_classifications(entity_type);

  -- Create a composite index for common query patterns
  CREATE INDEX idx_table_classifications_compound ON table_classifications(entity_type, entity_id,
  subject_classification_id);

  -- Add comment to explain the table's purpose
  COMMENT ON TABLE table_classifications IS 'Junction table allowing many-to-many relationships 
  between various entities and subject classifications';
  
-- Create a view that joins table_classifications to expert_documents and related tables
CREATE OR REPLACE VIEW document_classifications_view AS
SELECT 
  sg.filename AS file_name,
  ed.processed_content,
  dt.document_type,
  sc.short_name AS subject_classification
FROM 
  table_classifications tc
JOIN 
  expert_documents ed ON tc.entity_id = ed.id AND tc.entity_type = 'expert_document'
JOIN 
  document_types dt ON ed.document_type_id = dt.id
JOIN 
  subject_classifications sc ON tc.subject_classification_id = sc.id
LEFT JOIN 
  sources_google sg ON ed.source_id = sg.id
ORDER BY 
  sg.filename;


  Here are all the objects involved.

  I need you to fill in the presentations table records.
  first go through each sources_google file that is an mp4 file and create a presentation record for it.

  From the sources_google file you can get the id field, and the video_source_id is the id of the mp4 file from sources_google. Also the web_view_link is the web view link of the mp4 file from sources_google, as well as the root_drive_id. If possible provide the duration_seconds field from the size field of the sources_google file.

  Then find the related expert_documents record and you can pull the title from the dedicted field and transfer it to the presentations title field.

  after you have created the presentation record with these basic fields for each mp4 file, 
then you need to recursively (up to 6 levels go through all the records in sources_google and find the 









CREATE TABLE "presentations" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT,
    high_level_folder_source_id UUID REFERENCES sources_google(id),  -- Assuming this references a sources_google table
    video_source_id UUID REFERENCES sources_google(id),              -- Assuming this references a sources_google table
    web_view_link TEXT,
    root_drive_id TEXT,
    expert_document_id UUID REFERENCES expert_documents(id),
    expert_id UUID REFERENCES experts(id),
    view_count INTEGER DEFAULT 0,
    duration_seconds INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Add indexes for frequently queried fields and foreign keys
    CONSTRAINT view_count_non_negative CHECK (view_count >= 0),
    CONSTRAINT duration_seconds_non_negative CHECK (duration_seconds >= 0)
);

     presentations: {
        Row: {
          created_at: string | null
          duration_seconds: number | null
          expert_document_id: string | null
          expert_id: string | null
          high_level_folder_source_id: string | null
          id: string
          root_drive_id: string | null
          title: string | null
          updated_at: string | null
          video_source_id: string | null
          view_count: number | null
          web_view_link: string | null
        }
