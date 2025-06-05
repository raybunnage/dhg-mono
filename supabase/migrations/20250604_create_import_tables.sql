-- Create import tables for SQLite email data migration
-- These are temporary tables to hold the imported data before mapping to the new schema

-- Import emails table
CREATE TABLE IF NOT EXISTS import_emails (
    email_id INTEGER PRIMARY KEY,
    date TIMESTAMPTZ,
    sender TEXT,
    subject TEXT,
    to_recipients TEXT,
    content TEXT,
    attachment_cnt INTEGER,
    url_cnt INTEGER,
    is_ai_process_for_concepts INTEGER,
    contents_length INTEGER,
    is_in_contents INTEGER,
    is_in_concepts INTEGER,
    created_at TIMESTAMP,
    is_valid INTEGER
);

-- Import important email addresses
CREATE TABLE IF NOT EXISTS import_important_email_addresses (
    important_email_address_id INTEGER PRIMARY KEY,
    email_address TEXT NOT NULL,
    is_important BOOLEAN
);

-- Import email contents
CREATE TABLE IF NOT EXISTS import_email_contents (
    email_content_id INTEGER PRIMARY KEY,
    email_id INTEGER,
    how_many_participants INTEGER,
    participants TEXT,
    summary_of_the_email TEXT,
    is_science_discussion INTEGER,
    is_science_material INTEGER,
    is_meeting_focused INTEGER,
    good_quotes TEXT
);

-- Import email concepts
CREATE TABLE IF NOT EXISTS import_email_concepts (
    email_concept_id INTEGER PRIMARY KEY,
    email_id INTEGER,
    email_content_id INTEGER,
    concept TEXT,
    category TEXT,
    summary TEXT,
    example TEXT,
    url TEXT,
    date TEXT,
    citation TEXT,
    section_info TEXT,
    reference_info TEXT,
    source_name TEXT,
    actual_quote TEXT,
    quote_author TEXT,
    created_at TIMESTAMP,
    backup_category TEXT,
    master_category TEXT,
    is_valid INTEGER,
    auto_learning_grade INTEGER,
    subject_classifications TEXT,
    year INTEGER
);

-- Import attachments
CREATE TABLE IF NOT EXISTS import_attachments (
    attachment_id INTEGER PRIMARY KEY,
    email_id INTEGER,
    filename TEXT,
    size INTEGER,
    newpdf_id INTEGER,
    created_at TIMESTAMP
);

-- Import all email urls
CREATE TABLE IF NOT EXISTS import_all_email_urls (
    all_email_url_id INTEGER PRIMARY KEY,
    email_id INTEGER,
    url TEXT,
    created_at TIMESTAMP
);

-- Import rolled up emails
CREATE TABLE IF NOT EXISTS import_rolled_up_emails (
    rolled_up_email_id INTEGER PRIMARY KEY,
    subject TEXT,
    count INTEGER,
    first_date TEXT,
    last_date TEXT,
    senders TEXT,
    total_attachments INTEGER,
    total_urls INTEGER,
    is_likely_url INTEGER,
    email_ids TEXT,
    content_lengths TEXT
);

-- Import urls
CREATE TABLE IF NOT EXISTS import_urls (
    url_id INTEGER PRIMARY KEY,
    url TEXT,
    email_ids_count INTEGER,
    email_ids_text TEXT,
    earliest_id_datetime TIMESTAMPTZ,
    latest_id_datetime TIMESTAMPTZ,
    email_senders TEXT,
    email_subjects TEXT,
    is_process_concepts_with_ai INTEGER,
    is_openable_url INTEGER,
    article_year INTEGER,
    article_month INTEGER,
    article_day INTEGER,
    title TEXT,
    authors TEXT,
    summary TEXT,
    keywords TEXT,
    url_source TEXT,
    url_type TEXT,
    created_at TIMESTAMP,
    is_in_source INTEGER,
    is_extract_concepts_from_url INTEGER
);

-- Import web concepts
CREATE TABLE IF NOT EXISTS import_web_concepts (
    web_concept_id INTEGER PRIMARY KEY,
    url_id INTEGER,
    concept TEXT,
    category TEXT,
    summary TEXT,
    example TEXT,
    url TEXT,
    date TEXT,
    citation TEXT,
    section TEXT,
    header TEXT,
    reference_info TEXT,
    source_name TEXT,
    quote TEXT,
    learning_grade INTEGER,
    created_at TIMESTAMP,
    quote_author TEXT,
    subject_classifications TEXT,
    auto_learning_grade INTEGER,
    learning_grade_reason TEXT,
    master_category TEXT,
    is_valid INTEGER,
    mixed_case_category TEXT,
    backup_category TEXT,
    year INTEGER
);

-- Add indexes for foreign key relationships
CREATE INDEX IF NOT EXISTS idx_import_email_contents_email_id ON import_email_contents(email_id);
CREATE INDEX IF NOT EXISTS idx_import_email_concepts_email_id ON import_email_concepts(email_id);
CREATE INDEX IF NOT EXISTS idx_import_email_concepts_content_id ON import_email_concepts(email_content_id);
CREATE INDEX IF NOT EXISTS idx_import_attachments_email_id ON import_attachments(email_id);
CREATE INDEX IF NOT EXISTS idx_import_all_email_urls_email_id ON import_all_email_urls(email_id);
CREATE INDEX IF NOT EXISTS idx_import_web_concepts_url_id ON import_web_concepts(url_id);

-- Add to sys_table_definitions
INSERT INTO sys_table_definitions (table_schema, table_name, description, purpose, created_date)
VALUES 
    ('public', 'import_emails', 'Imported emails from SQLite', 'Temporary import table for email migration', CURRENT_DATE),
    ('public', 'import_important_email_addresses', 'Imported important email addresses', 'Temporary import table for migration', CURRENT_DATE),
    ('public', 'import_email_contents', 'Imported email contents analysis', 'Temporary import table for migration', CURRENT_DATE),
    ('public', 'import_email_concepts', 'Imported email concepts', 'Temporary import table for migration', CURRENT_DATE),
    ('public', 'import_attachments', 'Imported email attachments', 'Temporary import table for migration', CURRENT_DATE),
    ('public', 'import_all_email_urls', 'Imported email URLs', 'Temporary import table for migration', CURRENT_DATE),
    ('public', 'import_rolled_up_emails', 'Imported rolled up email summaries', 'Temporary import table for migration', CURRENT_DATE),
    ('public', 'import_urls', 'Imported URL metadata', 'Temporary import table for migration', CURRENT_DATE),
    ('public', 'import_web_concepts', 'Imported web page concepts', 'Temporary import table for migration', CURRENT_DATE)
ON CONFLICT (table_schema, table_name) DO NOTHING;