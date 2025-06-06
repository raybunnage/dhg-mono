# Email Source Tracking Schema Design

## Current State
The `auth_allowed_emails` table currently has:
- id, email, name, organization
- added_at, added_by, notes, is_active
- metadata, auth_user_id, auth_status
- created_at, updated_at, last_login_at
- login_count, email_verified, email_verified_at
- preferences

Total emails: 6

## Proposed Schema Design

### 1. Create `email_sources` table
```sql
CREATE TABLE email_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_code VARCHAR(50) UNIQUE NOT NULL,
  source_name VARCHAR(255) NOT NULL,
  description TEXT,
  source_type VARCHAR(50), -- 'gmail_flow', 'curated_list', 'import', etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Initial sources
INSERT INTO email_sources (source_code, source_name, source_type, description) VALUES
('rays_gmail_flow', 'Ray''s Gmail Flow (2020-2025)', 'gmail_flow', 'Email addresses collected from Ray''s Gmail interactions over the past 5 years'),
('dhg_curated_list', 'Dynamic Healing Group Curated List', 'curated_list', 'Manually curated email list from Dynamic Healing Group stakeholders');
```

### 2. Create `email_source_associations` junction table
```sql
CREATE TABLE email_source_associations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID NOT NULL REFERENCES auth_allowed_emails(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES email_sources(id) ON DELETE CASCADE,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  import_metadata JSONB, -- Store import details like filename, row number, etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(email_id, source_id) -- Prevent duplicate associations
);

-- Index for performance
CREATE INDEX idx_email_source_email_id ON email_source_associations(email_id);
CREATE INDEX idx_email_source_source_id ON email_source_associations(source_id);
```

### 3. Add primary source tracking to auth_allowed_emails
```sql
ALTER TABLE auth_allowed_emails 
ADD COLUMN primary_source_id UUID REFERENCES email_sources(id),
ADD COLUMN source_count INTEGER DEFAULT 1;

-- Create trigger to update source_count
CREATE OR REPLACE FUNCTION update_email_source_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE auth_allowed_emails 
  SET source_count = (
    SELECT COUNT(*) 
    FROM email_source_associations 
    WHERE email_id = NEW.email_id
  )
  WHERE id = NEW.email_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_source_count_trigger
AFTER INSERT OR DELETE ON email_source_associations
FOR EACH ROW
EXECUTE FUNCTION update_email_source_count();
```

### 4. Future: Person-to-Email mapping (for multiple emails per person)
```sql
-- For future implementation when needed
CREATE TABLE persons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_email_id UUID REFERENCES auth_allowed_emails(id),
  full_name VARCHAR(255),
  merged_metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE person_emails (
  person_id UUID REFERENCES persons(id) ON DELETE CASCADE,
  email_id UUID REFERENCES auth_allowed_emails(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT FALSE,
  relationship_type VARCHAR(50), -- 'personal', 'work', 'alternate', etc.
  verified_at TIMESTAMPTZ,
  PRIMARY KEY (person_id, email_id)
);
```

## Implementation Plan

1. **Phase 1: Add Source Tracking**
   - Create email_sources table
   - Create email_source_associations junction table
   - Add primary_source_id to auth_allowed_emails
   - Update existing 6 emails with 'rays_gmail_flow' source

2. **Phase 2: Import Excel Data**
   - Parse Excel file
   - Check for existing emails (case-insensitive)
   - Add new emails with 'dhg_curated_list' source
   - Update existing emails to have both sources

3. **Phase 3: Future Enhancement**
   - Implement person-to-email mapping when needed
   - Add UI for managing email sources
   - Add source filtering in authentication

## Source Names Suggestion

1. **Ray's Gmail Flow**: `rays_gmail_flow` - "Ray's Gmail Network (2020-2025)"
2. **DHG Curated List**: `dhg_curated_list` - "Dynamic Healing Group Members"

## Import Process Flow

```typescript
async function importEmailsWithSource(emails: string[], sourceCode: string) {
  const source = await getSourceByCode(sourceCode);
  
  for (const email of emails) {
    const normalized = email.toLowerCase().trim();
    
    // Check if email exists
    const existing = await supabase
      .from('auth_allowed_emails')
      .select('id')
      .ilike('email', normalized)
      .single();
    
    if (existing) {
      // Add source association
      await supabase
        .from('email_source_associations')
        .insert({
          email_id: existing.id,
          source_id: source.id
        });
    } else {
      // Create new email
      const { data: newEmail } = await supabase
        .from('auth_allowed_emails')
        .insert({
          email: normalized,
          primary_source_id: source.id,
          added_at: new Date().toISOString(),
          is_active: true
        })
        .select()
        .single();
      
      // Create source association
      await supabase
        .from('email_source_associations')
        .insert({
          email_id: newEmail.id,
          source_id: source.id
        });
    }
  }
}
```