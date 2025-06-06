-- Create import_web_concepts2 table in PostgreSQL/Supabase
DROP TABLE IF EXISTS import_web_concepts2;

CREATE TABLE import_web_concepts2 (
    web_concept_id SERIAL PRIMARY KEY,
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
    created_at TIMESTAMPTZ,
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

-- Create indexes for better performance
CREATE INDEX idx_import_web_concepts2_url_id ON import_web_concepts2(url_id);
CREATE INDEX idx_import_web_concepts2_category ON import_web_concepts2(category);
CREATE INDEX idx_import_web_concepts2_year ON import_web_concepts2(year);