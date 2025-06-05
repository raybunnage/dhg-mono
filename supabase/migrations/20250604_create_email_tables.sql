-- Create email important addresses table
CREATE TABLE IF NOT EXISTS email_important_addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_address TEXT NOT NULL UNIQUE,
    importance_level INTEGER DEFAULT 1 CHECK (importance_level >= 1 AND importance_level <= 3),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX idx_email_important_addresses_email ON email_important_addresses(email_address);
CREATE INDEX idx_email_important_addresses_importance ON email_important_addresses(importance_level);

-- Enable RLS
ALTER TABLE email_important_addresses ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (admin only for now)
CREATE POLICY "Admin users can manage email addresses"
    ON email_important_addresses
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'admin')
    WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Add table metadata
INSERT INTO sys_table_definitions (table_schema, table_name, description, purpose, created_date)
VALUES ('public', 'email_important_addresses', 'Important email addresses for Gmail sync', 'Controls which email addresses to prioritize in Gmail synchronization', CURRENT_DATE)
ON CONFLICT (table_schema, table_name) DO NOTHING;

-- Create other email tables that will be needed later

-- Email processed contents
CREATE TABLE IF NOT EXISTS email_processed_contents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_message_id UUID REFERENCES email_messages(id) ON DELETE CASCADE,
    participants_count INTEGER,
    participants JSONB,
    summary TEXT,
    is_science_discussion BOOLEAN DEFAULT FALSE,
    is_science_material BOOLEAN DEFAULT FALSE,
    is_meeting_focused BOOLEAN DEFAULT FALSE,
    notable_quotes JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_email_processed_contents_message ON email_processed_contents(email_message_id);
CREATE INDEX idx_email_processed_contents_science ON email_processed_contents(is_science_discussion, is_science_material);

-- Email extracted concepts
CREATE TABLE IF NOT EXISTS email_extracted_concepts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_message_id UUID REFERENCES email_messages(id) ON DELETE CASCADE,
    email_content_id UUID REFERENCES email_processed_contents(id) ON DELETE CASCADE,
    concept TEXT NOT NULL,
    category TEXT,
    summary TEXT,
    example TEXT,
    quote TEXT,
    quote_author TEXT,
    confidence_score FLOAT,
    subject_classifications JSONB,
    is_valid BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_email_extracted_concepts_message ON email_extracted_concepts(email_message_id);
CREATE INDEX idx_email_extracted_concepts_category ON email_extracted_concepts(category);
CREATE INDEX idx_email_extracted_concepts_valid ON email_extracted_concepts(is_valid);

-- Email extracted URLs
CREATE TABLE IF NOT EXISTS email_extracted_urls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_message_id UUID REFERENCES email_messages(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_email_extracted_urls_message ON email_extracted_urls(email_message_id);
CREATE INDEX idx_email_extracted_urls_url ON email_extracted_urls(url);

-- Research URLs (aggregated)
CREATE TABLE IF NOT EXISTS research_urls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    url TEXT UNIQUE NOT NULL,
    domain TEXT,
    email_associations JSONB DEFAULT '{"email_ids": [], "senders": [], "subjects": []}'::jsonb,
    email_count INTEGER DEFAULT 1,
    first_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Content metadata
    title TEXT,
    authors TEXT[],
    summary TEXT,
    keywords TEXT[],
    published_date DATE,
    -- Processing flags
    is_processed BOOLEAN DEFAULT FALSE,
    is_accessible BOOLEAN,
    process_ai_concepts BOOLEAN DEFAULT FALSE,
    -- Type and source
    url_type TEXT,
    content_source TEXT,
    -- Metadata
    extraction_metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_research_urls_domain ON research_urls(domain);
CREATE INDEX idx_research_urls_processed ON research_urls(is_processed);
CREATE INDEX idx_research_urls_url_type ON research_urls(url_type);

-- Email thread aggregations
CREATE TABLE IF NOT EXISTS email_thread_aggregations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_pattern TEXT NOT NULL,
    email_count INTEGER DEFAULT 1,
    first_email_date TIMESTAMP WITH TIME ZONE,
    last_email_date TIMESTAMP WITH TIME ZONE,
    senders TEXT[],
    total_attachments INTEGER DEFAULT 0,
    total_urls INTEGER DEFAULT 0,
    email_ids UUID[],
    is_likely_research BOOLEAN DEFAULT FALSE,
    thread_metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_email_thread_aggregations_subject ON email_thread_aggregations(subject_pattern);
CREATE INDEX idx_email_thread_aggregations_research ON email_thread_aggregations(is_likely_research);

-- Email attachments
CREATE TABLE IF NOT EXISTS email_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_message_id UUID REFERENCES email_messages(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    file_extension TEXT,
    size_bytes INTEGER,
    mime_type TEXT,
    is_processed BOOLEAN DEFAULT FALSE,
    google_drive_id TEXT,
    processing_metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_email_attachments_message ON email_attachments(email_message_id);
CREATE INDEX idx_email_attachments_extension ON email_attachments(file_extension);
CREATE INDEX idx_email_attachments_processed ON email_attachments(is_processed);

-- Add table metadata for all new tables
INSERT INTO sys_table_definitions (table_schema, table_name, description, purpose, created_date)
VALUES 
    ('public', 'email_processed_contents', 'AI-processed email content', 'Stores analyzed email content including participants and summaries', CURRENT_DATE),
    ('public', 'email_extracted_concepts', 'Concepts extracted from emails', 'Knowledge and insights extracted from email content', CURRENT_DATE),
    ('public', 'email_extracted_urls', 'URLs found in emails', 'Raw URL extraction from email bodies', CURRENT_DATE),
    ('public', 'research_urls', 'Aggregated research URLs', 'Processed and enriched URL information from emails', CURRENT_DATE),
    ('public', 'email_thread_aggregations', 'Email thread statistics', 'Aggregated data about email conversations', CURRENT_DATE),
    ('public', 'email_attachments', 'Email attachment metadata', 'Information about files attached to emails', CURRENT_DATE)
ON CONFLICT (table_schema, table_name) DO NOTHING;