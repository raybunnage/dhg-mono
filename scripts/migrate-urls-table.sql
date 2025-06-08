-- Create import_urls2 table in PostgreSQL/Supabase
DROP TABLE IF EXISTS import_urls2;

CREATE TABLE import_urls2 (
    url_id SERIAL PRIMARY KEY,
    url TEXT UNIQUE,
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
    created_at TIMESTAMPTZ,
    is_in_source INTEGER,
    is_extract_concepts_from_url INTEGER
);

-- Create indexes for better performance
CREATE INDEX idx_import_urls2_url ON import_urls2(url);
CREATE INDEX idx_import_urls2_created_at ON import_urls2(created_at);