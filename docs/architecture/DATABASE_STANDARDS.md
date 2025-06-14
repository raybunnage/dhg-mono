# Database Standards and Conventions

## Table Creation Standards

### 1. Naming Conventions

#### Tables
- **Use snake_case**: `user_profiles`, not `UserProfiles` or `userProfiles`
- **Use plural names**: `users`, not `user`
- **Prefix with domain**: `auth_users`, `media_assets`, `doc_templates`
- **Be descriptive**: `user_profile_settings` not `settings`

#### Columns
- **Use snake_case**: `created_at`, not `createdAt`
- **Foreign keys**: `{table}_id` (e.g., `user_id`, `document_id`)
- **Booleans**: `is_` or `has_` prefix (e.g., `is_active`, `has_access`)
- **Timestamps**: `_at` suffix (e.g., `created_at`, `updated_at`, `deleted_at`)
- **Counts**: `_count` suffix (e.g., `view_count`, `download_count`)

### 2. Required Base Fields

Every table MUST have these fields:

```sql
-- Timestamps
created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

-- Soft delete support (optional but recommended)
deleted_at TIMESTAMPTZ,
is_deleted BOOLEAN DEFAULT FALSE NOT NULL,

-- Audit fields (recommended)
created_by UUID REFERENCES auth.users(id),
updated_by UUID REFERENCES auth.users(id),

-- Version control (for important tables)
version INTEGER DEFAULT 1 NOT NULL,
```

### 3. Field Types Best Practices

```sql
-- IDs: Always use UUID
id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

-- Text: Use appropriate sizes
short_text VARCHAR(255),     -- Names, titles
medium_text TEXT,            -- Descriptions, comments
long_text TEXT,              -- Content, documents
json_data JSONB,            -- Structured data

-- Money: Use DECIMAL
price DECIMAL(10, 2),       -- Never FLOAT for money

-- Dates: Always TIMESTAMPTZ
event_date TIMESTAMPTZ,     -- Never TIMESTAMP without timezone
```

### 4. What NOT to Do

❌ **NEVER**:
- Use SERIAL/BIGSERIAL for IDs (use UUID)
- Store timestamps without timezone
- Use FLOAT for monetary values
- Create tables without RLS policies
- Use reserved keywords as column names
- Store calculated values that can be derived
- Create circular foreign key dependencies

### 5. Delete Strategy

#### Soft Delete (Preferred)
```sql
-- Add to every table that needs delete functionality
deleted_at TIMESTAMPTZ,
is_deleted BOOLEAN DEFAULT FALSE NOT NULL,

-- Create view for active records
CREATE VIEW active_users AS
SELECT * FROM users WHERE NOT is_deleted;

-- Delete function
UPDATE users SET 
  is_deleted = TRUE,
  deleted_at = NOW(),
  updated_by = auth.uid()
WHERE id = $1;
```

#### Hard Delete (Exceptions Only)
- Temporary data (sessions, tokens)
- Log entries older than retention period
- Test data in non-production

### 6. Triggers vs Application Logic

#### Use Triggers For:
- `updated_at` timestamp updates
- Audit logging
- Data validation that must never be bypassed
- Cascading soft deletes

#### Use Application Logic For:
- Business rules that may change
- Complex calculations
- External API calls
- Multi-table transactions

### 7. Index Standards

```sql
-- Primary key (automatic)
-- Foreign keys (create explicitly)
CREATE INDEX idx_orders_user_id ON orders(user_id);

-- Commonly queried fields
CREATE INDEX idx_users_email ON users(email);

-- Composite indexes for common queries
CREATE INDEX idx_posts_user_created ON posts(user_id, created_at DESC);

-- Partial indexes for filtered queries
CREATE INDEX idx_active_users ON users(email) WHERE NOT is_deleted;
```

## Continuous Improvement Standards

### 1. Orphaned Object Detection

Objects that commonly become orphaned:
- Functions no longer called
- Views referencing dropped tables
- Indexes on dropped columns
- Policies on deleted tables
- Unused sequences

### 2. Function Management

```sql
-- Standard function naming
{action}_{object}_{detail}
-- Examples:
get_user_by_email()
calculate_order_total()
validate_document_access()

-- Function categories:
fn_get_*     -- Data retrieval
fn_calc_*    -- Calculations
fn_validate_* -- Validation
fn_process_*  -- Business logic
fn_sync_*    -- Synchronization
```

### 3. Retroactive Standards Application

Priority order for cleanup:
1. Add missing base fields
2. Fix naming inconsistencies
3. Add missing indexes
4. Enable RLS where missing
5. Clean up orphaned objects
6. Optimize poorly performing queries

### 4. Monitoring Metrics

Track these database health indicators:
- Tables without RLS
- Missing foreign key indexes
- Functions not called in 30 days
- Tables with no updated_at trigger
- Columns with 100% NULL values
- Duplicate indexes
- Missing primary keys

## Implementation Checklist

### For New Tables
- [ ] Follow naming conventions
- [ ] Include all base fields
- [ ] Add appropriate indexes
- [ ] Enable RLS
- [ ] Create policies
- [ ] Add to sys_table_definitions
- [ ] Document purpose
- [ ] Add updated_at trigger

### For Existing Tables
- [ ] Audit against standards
- [ ] Create migration plan
- [ ] Test in development
- [ ] Apply changes
- [ ] Update documentation
- [ ] Monitor for issues

## Automated Enforcement

The continuous monitoring system checks for:
1. Tables missing base fields
2. Missing RLS policies
3. Orphaned database objects
4. Non-standard naming
5. Missing indexes on foreign keys
6. Unused functions and views
7. Performance issues

## Standard Patterns

### 1. Audit Table Pattern
```sql
CREATE TABLE audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data JSONB,
  new_data JSONB,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
```

### 2. Soft Delete Pattern
```sql
-- Trigger to prevent hard deletes
CREATE TRIGGER prevent_hard_delete
BEFORE DELETE ON important_table
FOR EACH ROW
EXECUTE FUNCTION raise_exception('Use soft delete instead');
```

### 3. Updated At Pattern
```sql
-- Standard trigger for all tables
CREATE TRIGGER update_updated_at
BEFORE UPDATE ON table_name
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```