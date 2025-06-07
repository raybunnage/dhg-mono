-- Create a temporary staging table
CREATE TEMP TABLE staging_urls (
    url_id TEXT,
    url TEXT,
    email_ids_count TEXT,
    email_ids_text TEXT,
    earliest_id_datetime TEXT,
    latest_id_datetime TEXT,
    email_senders TEXT,
    email_subjects TEXT,
    is_process_concepts_with_ai TEXT,
    is_openable_url TEXT,
    article_year TEXT,
    article_month TEXT,
    article_day TEXT,
    title TEXT,
    authors TEXT,
    summary TEXT,
    keywords TEXT,
    url_source TEXT,
    url_type TEXT,
    created_at TEXT,
    is_in_source TEXT,
    is_extract_concepts_from_url TEXT
);

-- Import CSV into staging table
\COPY staging_urls FROM '/Users/raybunnage/Documents/github/dhg-mono/scripts/urls-export.csv' WITH (FORMAT csv, HEADER true);

-- Insert into final table with proper type conversions and NULL handling
INSERT INTO import_urls2 (
    url_id, url, email_ids_count, email_ids_text, 
    earliest_id_datetime, latest_id_datetime,
    email_senders, email_subjects,
    is_process_concepts_with_ai, is_openable_url,
    article_year, article_month, article_day,
    title, authors, summary, keywords,
    url_source, url_type, created_at,
    is_in_source, is_extract_concepts_from_url
)
SELECT 
    CAST(NULLIF(url_id, '') AS INTEGER),
    url,
    CAST(NULLIF(email_ids_count, '') AS INTEGER),
    email_ids_text,
    CAST(NULLIF(earliest_id_datetime, '') AS TIMESTAMPTZ),
    CAST(NULLIF(latest_id_datetime, '') AS TIMESTAMPTZ),
    email_senders,
    email_subjects,
    CAST(NULLIF(is_process_concepts_with_ai, '') AS INTEGER),
    CAST(NULLIF(is_openable_url, '') AS INTEGER),
    CAST(NULLIF(article_year, '') AS INTEGER),
    CAST(NULLIF(article_month, '') AS INTEGER),
    CAST(NULLIF(article_day, '') AS INTEGER),
    title,
    authors,
    summary,
    keywords,
    url_source,
    url_type,
    CAST(NULLIF(created_at, '') AS TIMESTAMPTZ),
    CAST(NULLIF(is_in_source, '') AS INTEGER),
    CAST(NULLIF(is_extract_concepts_from_url, '') AS INTEGER)
FROM staging_urls;

-- Check the results
SELECT COUNT(*) as total_rows FROM import_urls2;
EOF < /dev/null