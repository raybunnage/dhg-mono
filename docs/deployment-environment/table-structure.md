# Database Table Structure Reference

## experts

| Column | Type | Nullable | Default | Description |
|--------|------|----------|----------|-------------|
| id | uuid | NOT NULL | gen_random_uuid() | Primary key |
| expert_name | text | NOT NULL | | Unique expert identifier |
| full_name | text | | | Expert's full name |
| starting_ref_id | integer | | | Reference ID |
| is_in_core_group | boolean | NOT NULL | false | Core group membership |
| created_at | timestamptz | NOT NULL | CURRENT_TIMESTAMP | Creation timestamp |
| updated_at | timestamptz | NOT NULL | CURRENT_TIMESTAMP | Last update timestamp |
| created_by | uuid | NOT NULL | | Creator's user ID |
| updated_by | uuid | NOT NULL | | Last updater's user ID |
| user_id | uuid | | | Associated user account |
| expertise_area | text | | | Field of expertise |
| bio | text | | | Expert biography |
| experience_years | integer | | 0 | Years of experience |
| email_address | text | | | Primary email |
| legacy_expert_id | bigint | | | Legacy system ID |
| google_user_id | text | | | Google account ID |
| google_email | text | | | Google email |
| google_profile_data | jsonb | | | Google profile info |
| last_synced_at | timestamptz | | | Last Google sync |
| sync_status | text | | | Sync state |
| sync_error | text | | | Sync error message |

### Indexes
- `experts_pkey` PRIMARY KEY (id)
- `experts_user_id_idx` btree (user_id)
- `idx_experts_google_email` btree (google_email)
- `idx_experts_google_user_id` btree (google_user_id)
- `uq_experts_expert_name` UNIQUE (expert_name)

### Check Constraints
- `valid_email`: Email format validation
- `valid_google_email`: Google email format validation
- `valid_profile_data`: JSON object validation
- `valid_sync_status`: Status enum check

### Foreign Keys
- `created_by` → `auth.users(id)`
- `updated_by` → `auth.users(id)`

### Referenced By
- `citation_expert_aliases(expert_uuid)`
- `sources(expert_id)`
- `sources_google(expert_id)`

### Policies
- DELETE: Authenticated users
- INSERT: Authenticated users
- UPDATE: Authenticated users
- SELECT: Authenticated users

### Triggers
- `set_updated_at`: Updates timestamp

## sources_google

| Column | Type | Nullable | Default | Description |
|--------|------|----------|----------|-------------|
| id | uuid | NOT NULL | uuid_generate_v4() | Primary key |
| drive_id | text | NOT NULL | | Google Drive ID |
| name | text | NOT NULL | | File/folder name |
| mime_type | text | NOT NULL | | Content type |
| web_view_link | text | | | Google Drive link |
| parent_folder_id | text | | | Parent folder ID |
| is_root | boolean | | false | Root folder flag |
| path | text[] | | | Folder path array |
| created_at | timestamptz | NOT NULL | timezone('utc'::text, now()) | Creation time |
| updated_at | timestamptz | NOT NULL | timezone('utc'::text, now()) | Update time |
| created_by | uuid | | | Creator's user ID |
| updated_by | uuid | | | Updater's user ID |
| last_indexed | timestamptz | | | Last index time |
| metadata | jsonb | | | File metadata |
| expert_id | uuid | | | Associated expert |
| sync_status | text | | | Sync state |
| sync_error | text | | | Sync error message |
| document_type_id | uuid | | | Document type |
| content_extracted | boolean | | false | Extraction flag |
| extraction_error | text | | | Extraction error |
| extracted_content | jsonb | | | Extracted content |

### Indexes
- `sources_google_pkey` PRIMARY KEY (id)
- `idx_sources_google_content_extracted` btree (content_extracted)
- `idx_sources_google_document_type_id` btree (document_type_id)
- `idx_sources_google_expert_id` btree (expert_id)
- `sources_google_drive_id_key` UNIQUE (drive_id)
- `sources_google_mime_type_idx` btree (mime_type)
- `sources_google_parent_idx` btree (parent_folder_id)
- `sources_google_path_idx` gin (path)

### Check Constraints
- `valid_extracted_content`: JSON validation
- `valid_sync_status`: Status enum check

### Foreign Keys
- `created_by` → `auth.users(id)`
- `document_type_id` → `document_types(id)`
- `expert_id` → `experts(id)`
- `parent_folder_id` → `sources_google(drive_id)`
- `updated_by` → `auth.users(id)`

### Policies
- INSERT: Authenticated users
- SELECT: Authenticated users
- UPDATE: Authenticated users

### Triggers
- `handle_sources_google_updated_at`: Updates timestamp

## expert_documents

| Column | Type | Nullable | Default | Description |
|--------|------|----------|----------|-------------|
| id | uuid | NOT NULL | gen_random_uuid() | Primary key |
| expert_id | uuid | | | Associated expert |
| source_id | uuid | | | Source document |
| document_type_id | uuid | | | Document type |
| raw_content | text | | | Original content |
| processed_content | jsonb | | | Processed content |
| ai_analysis | jsonb | | | AI analysis results |
| key_insights | text[] | | | Key findings |
| topics | text[] | | | Document topics |
| word_count | integer | | | Content length |
| language | text | | | Document language |
| confidence_score | numeric | | | Analysis confidence |
| processing_status | text | | | Processing state |
| processing_error | text | | | Processing error |
| created_at | timestamptz | NOT NULL | now() | Creation time |
| updated_at | timestamptz | NOT NULL | now() | Update time |
| created_by | uuid | | | Creator's user ID |
| updated_by | uuid | | | Updater's user ID |
| last_processed_at | timestamptz | | | Last processing |

### Indexes
- `expert_documents_pkey` PRIMARY KEY (id)
- `idx_expert_documents_document_type_id` btree (document_type_id)
- `idx_expert_documents_expert_id` btree (expert_id)
- `idx_expert_documents_processing_status` btree (processing_status)
- `idx_expert_documents_source_id` btree (source_id)
- `idx_expert_documents_topics` gin (topics)

### Check Constraints
- `expert_documents_processing_status_check`: Status enum check

### Foreign Keys
- `created_by` → `auth.users(id)`
- `document_type_id` → `document_types(id)`
- `expert_id` → `experts(id)`
- `source_id` → `sources_google(id)`
- `updated_by` → `auth.users(id)`

### Policies
- DELETE: Authenticated users
- INSERT: Authenticated users
- UPDATE: Authenticated users
- SELECT: Authenticated users

### Triggers
- `set_created_by_trigger`: Sets creator
- `set_updated_at`: Updates timestamp
- `set_updated_by_trigger`: Sets updater

## document_types

| Column | Type | Nullable | Default | Description |
|--------|------|----------|----------|-------------|
| id | uuid | NOT NULL | gen_random_uuid() | Primary key |
| document_type | text | NOT NULL | | Type identifier |
| current_num_of_type | integer | | 0 | Count of documents |
| description | text | | | Type description |
| mime_type | text | | | Content type |
| file_extension | text | | | File extension |
| document_type_counts | integer | | 0 | Usage count |
| category | text | NOT NULL | | Document category |
| created_by | uuid | NOT NULL | | Creator's user ID |
| updated_by | uuid | NOT NULL | | Updater's user ID |
| created_at | timestamptz | NOT NULL | now() | Creation time |
| updated_at | timestamptz | NOT NULL | now() | Update time |
| required_fields | jsonb | | | Required metadata |
| legacy_document_type_id | bigint | | | Legacy system ID |
| is_ai_generated | boolean | NOT NULL | false | AI generation flag |
| content_schema | jsonb | | | Content structure |
| ai_processing_rules | jsonb | | | AI processing config |
| validation_rules | jsonb | | | Validation rules |

### Indexes
- `uni_document_types_pkey` PRIMARY KEY (id)
- `idx_uni_document_types_document_type` btree (document_type)
- `unique_document_type_name` UNIQUE (document_type)

### Check Constraints
- `valid_ai_rules`: JSON validation
- `valid_content_schema`: JSON validation
- `valid_validation_rules`: JSON validation

### Referenced By
- `expert_documents(document_type_id)`
- `sources_google(document_type_id)`

### Policies
- DELETE: Authenticated users
- INSERT: Authenticated users
- UPDATE: Authenticated users
- SELECT: Authenticated users

### Triggers
- `set_created_by_trigger`: Sets creator
- `set_timestamps`: Updates timestamps
- `set_updated_at`: Updates timestamp
- `set_updated_by_trigger`: Sets updater 