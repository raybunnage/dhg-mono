-- Create enums for better data consistency
CREATE TYPE prompt_status AS ENUM ('draft', 'active', 'deprecated', 'archived');
CREATE TYPE relationship_type AS ENUM ('extends', 'references', 'prerequisite', 'alternative', 'successor');

-- Note: document_types table already exists, so we're not creating it

-- Prompt Categories Table
CREATE TABLE prompt_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    parent_category_id UUID REFERENCES prompt_categories(id), -- For hierarchical categories
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Prompts Table (with metadata)
CREATE TABLE prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    content JSONB NOT NULL, -- Store the actual prompt content (JSON or Markdown)
    metadata JSONB, -- Added metadata field for structured metadata from markdown
    document_type_id UUID REFERENCES document_types(id), -- Modified to UUID to match existing table
    category_id UUID REFERENCES prompt_categories(id), -- Reference to categories
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    version VARCHAR(50) DEFAULT '1.0',
    status prompt_status DEFAULT 'active',
    author VARCHAR(255),
    tags TEXT[], -- Use VARCHAR(255) for non-PostgreSQL databases
    file_path VARCHAR(500), -- Path to original file in Git repository
    UNIQUE(name, version)
);

-- Prompt Relationships Table
CREATE TABLE prompt_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_prompt_id UUID NOT NULL REFERENCES prompts(id),
    child_prompt_id UUID NOT NULL REFERENCES prompts(id),
    relationship_type relationship_type NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Prevent duplicate relationships of the same type
    UNIQUE(parent_prompt_id, child_prompt_id, relationship_type)
);

-- Optional: Prompt Usage Table (for tracking execution)
CREATE TABLE prompt_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_id UUID REFERENCES prompts(id),
    used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    function_name VARCHAR(255),
    success BOOLEAN DEFAULT true,
    execution_time INTEGER, -- in milliseconds
    response_summary TEXT
);

-- Note: This schema uses UUID for primary/foreign keys to match your existing document_types table
-- If you need to adapt this for a different DBMS, you may need to adjust the UUID generation approach
