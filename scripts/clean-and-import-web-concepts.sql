-- Create a temporary staging table
CREATE TEMP TABLE staging_web_concepts (
    web_concept_id TEXT,
    url_id TEXT,
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
    learning_grade TEXT,
    created_at TEXT,
    quote_author TEXT,
    subject_classifications TEXT,
    auto_learning_grade TEXT,
    learning_grade_reason TEXT,
    master_category TEXT,
    is_valid TEXT,
    mixed_case_category TEXT,
    backup_category TEXT,
    year TEXT
);

-- Import CSV into staging table
\COPY staging_web_concepts FROM '/Users/raybunnage/Documents/github/dhg-mono/scripts/web-concepts-export.csv' WITH (FORMAT csv, HEADER true);

-- Insert into final table with proper type conversions and NULL handling
INSERT INTO import_web_concepts2 (
    web_concept_id, url_id, concept, category, summary, example,
    url, date, citation, section, header, reference_info,
    source_name, quote, learning_grade, created_at, quote_author,
    subject_classifications, auto_learning_grade, learning_grade_reason,
    master_category, is_valid, mixed_case_category, backup_category, year
)
SELECT 
    CAST(NULLIF(web_concept_id, '') AS INTEGER),
    CAST(NULLIF(url_id, '') AS INTEGER),
    concept,
    category,
    summary,
    example,
    url,
    date,
    citation,
    section,
    header,
    reference_info,
    source_name,
    quote,
    CAST(NULLIF(learning_grade, '') AS INTEGER),
    CAST(NULLIF(created_at, '') AS TIMESTAMPTZ),
    quote_author,
    subject_classifications,
    CAST(NULLIF(auto_learning_grade, '') AS INTEGER),
    learning_grade_reason,
    master_category,
    CAST(NULLIF(is_valid, '') AS INTEGER),
    mixed_case_category,
    backup_category,
    CAST(NULLIF(year, '') AS INTEGER)
FROM staging_web_concepts;

-- Check the results
SELECT COUNT(*) as total_rows FROM import_web_concepts2;
EOF < /dev/null