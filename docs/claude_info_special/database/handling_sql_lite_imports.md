## ⚠️ CRITICAL: SQLite to Supabase Migration Safety

**ALWAYS CHECK FOR EXISTING TABLES BEFORE IMPORTING FROM SQLITE**

When migrating data from SQLite to Supabase, you MUST verify that the target table name doesn't conflict with existing Supabase tables. Importing with the same name as an existing table can **permanently overwrite critical data**.

**⚠️ CRITICAL Rules for SQLite Imports**:
1. **ALWAYS prefix imported tables with `import_`** - no exceptions
2. **ALWAYS check existing tables before creating any import table**
3. **NEVER use the same name as an existing Supabase table**
4. **ALWAYS verify the import script checks for existing tables**

**❌ DANGEROUS Example**:
```sql
-- If 'document_types' already exists in Supabase, this will DESTROY it!
CREATE TABLE document_types AS SELECT * FROM sqlite_export;
pgloader sqlite://file.db postgresql://... -- Without checking target tables!
```

**✅ SAFE Approach**:
```sql
-- 1. Always check for existing tables first
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('web_concepts', 'import_web_concepts');

-- 2. ALWAYS use import_ prefix for SQLite imports
CREATE TABLE import_document_types (...);  -- CORRECT: import_ prefix
CREATE TABLE import_web_concepts (...);    -- CORRECT: import_ prefix

-- 3. Keep backups before any migration
pg_dump ... > backup_before_migration.sql

-- 4. In your import scripts, ALWAYS include existence checks:
DROP TABLE IF EXISTS import_web_concepts;  -- Safe - only drops import table
CREATE TABLE import_web_concepts (...);
```

**Real Incident**: Tables like `document_types` and `ai_prompts` were accidentally overwritten because they had the same names in both SQLite and Supabase. This caused significant data loss that required restoration from backups. **This MUST never happen again.**

**Import Script Requirements**:
- Must check for existing tables before creating
- Must use `import_` prefix for all imported tables
- Must NOT drop or modify non-import tables
- Should include clear comments about what's being imported
