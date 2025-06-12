# Database Architecture & Management - Living Documentation

**Last Updated**: June 9, 2025  
**Next Review**: June 23, 2025 (14 days)  
**Status**: Active  
**Priority**: High  
**Related Archives**: 4 documents  

---

## 📋 Table of Contents

1. [Current Status & Lessons Learned](#current-status--lessons-learned)
2. [Recent Updates](#recent-updates)
3. [Next Phase](#next-phase)
4. [Upcoming Phases](#upcoming-phases)
5. [Priorities & Trade-offs](#priorities--trade-offs)
6. [Original Vision](#original-vision)
7. [Important Callouts](#important-callouts)
8. [Full Documentation](#full-documentation)

---

## Current Status & Lessons Learned

### 🎯 Current Status

The database has undergone a comprehensive reorganization with all 43 tables now following a consistent prefix-based naming strategy. The migration is complete and the system is stable.

**What's Working Well**:
- ✅ All tables organized into 13 functional domains with clear prefixes
- ✅ Migration tracking system operational (`sys_table_migrations`)
- ✅ Type safety maintained through automated type generation
- ✅ Zero-downtime migration approach proven successful
- ✅ Consistent naming conventions enforced

**Current Priority**:
- **Immediate Focus**: Activate dormant `learn_` tables with actual features
- **Blocking Issues**: None - database structure is stable
- **Next Milestone**: Learning platform tables populated by July 15, 2025

### 📚 Lessons Learned

1. **Prefix strategy improves discoverability** - Grouping by function makes navigation intuitive
2. **Migration tracking is essential** - `sys_table_migrations` prevents confusion
3. **Views enable zero-downtime migrations** - Compatibility layer works well
4. **Type generation must be automatic** - Manual updates lead to errors
5. **Empty tables indicate missing features** - 7 `learn_` tables await implementation

### ✅ Recent Actions Taken
- Completed prefix migration for all 43 tables
- Fixed naming issues (`filter_user_profiless` → `filter_user_profiles`)
- Implemented comprehensive migration tracking
- Automated type generation in migration workflow

---

## Recent Updates

- **June 11, 2025**: Added data preview feature to DatabasePage - click any table to see first 10 records
- **June 9, 2025**: Created this living documentation consolidating database specs
- **May 2025**: Completed phase 1 of prefix migration (37 table renames)
- **May 2025**: Implemented `sys_table_migrations` tracking system

---

## Next Phase

### 🚀 Phase: Feature Activation
**Target Date**: July 15, 2025  
**Status**: Planning  

- [ ] Populate `learn_` tables with learning platform features
- [ ] Implement missing indexes for performance
- [ ] Activate `google_sync_*` tracking tables
- [ ] Create notification system tables
- [ ] Add junction tables for many-to-many relationships

---

## Upcoming Phases

### Phase 2: Performance Optimization (August 2025)
- Comprehensive index analysis
- Query performance tuning
- Implement database monitoring
- Add slow query logging

### Phase 3: Advanced Features (September 2025)
- Full-text search implementation
- Audit trail system
- Soft delete patterns
- Archive strategy for old data

---

## Priorities & Trade-offs

### Current Priorities
1. **Activate dormant features** - Empty tables represent unrealized value
2. **Maintain naming consistency** - All new tables must follow conventions
3. **Performance over features** - Optimize before adding complexity

### Pros & Cons Analysis
**Pros:**
- ✅ Clear organizational structure
- ✅ Easy to find related tables
- ✅ Consistent patterns reduce errors
- ✅ Migration tracking prevents confusion

**Cons:**
- ❌ Initial migration was complex
- ❌ Some table names became longer
- ❌ Required updating all code references

---

## Original Vision

Create a well-organized, scalable database architecture that groups related functionality through consistent naming conventions. The prefix strategy should make it immediately clear what domain each table belongs to, while migration tracking ensures changes are documented and reversible.

---

## ⚠️ Important Callouts

⚠️ **Always use established prefixes** - Check the prefix list before creating new tables

⚠️ **Track all migrations** - Use `sys_table_migrations` for every schema change

⚠️ **Regenerate types after migrations** - Run the type generation command

⚠️ **Views must use primary table prefix** - Ensures proper sorting in tools

---

## Full Documentation

### Database Organization

**43 Tables in 13 Functional Domains**:

| Prefix | Domain | Tables | Status | Records |
|--------|--------|--------|--------|---------|
| `learn_` | Learning Platform | 11 | 🔴 Empty | 0 |
| `ai_` | AI & Prompts | 5 | ✅ Active | 500+ |
| `google_` | Google Drive | 5 | ⚠️ Partial | 15,000+ |
| `auth_` | Authentication | 4 | ✅ Active | 50+ |
| `doc_` | Documents | 3 | ✅ Active | 1,000+ |
| `command_` | CLI Commands | 3 | ✅ Active | 500+ |
| `media_` | Media Content | 2 | ✅ Active | 5,000+ |
| `expert_` | Expert Profiles | 2 | ✅ Active | 100+ |
| `email_` | Email System | 2 | 🔴 Empty | 0 |
| `filter_` | User Filters | 2 | ✅ Active | 10+ |
| `sys_` | System | 2 | ✅ Active | 50+ |
| `batch_` | Batch Processing | 1 | ✅ Active | 100+ |
| `scripts_` | Script Registry | 1 | ✅ Active | 100+ |

### Naming Conventions

```
prefix_entity_name
│      │
│      └─ Descriptive name (plural for collections)
└─ Functional domain (3-7 characters)
```

**Examples**:
- ✅ `auth_users` - Collection of users
- ✅ `sys_config` - Single configuration record
- ✅ `learn_user_courses` - Junction table
- ❌ `auth_auth_tokens` - Avoid double prefixes
- ❌ `users` - Must have prefix

### Migration Workflow

```bash
# 1. Check existing prefixes
SELECT DISTINCT split_part(table_name, '_', 1) as prefix 
FROM information_schema.tables 
WHERE table_schema = 'public';

# 2. Plan migration
./scripts/cli-pipeline/database/database-cli.sh migration plan

# 3. Create migration file
./scripts/cli-pipeline/database/database-cli.sh migration create \
  --name "add_notification_tables"

# 4. Test migration
./scripts/cli-pipeline/database/database-cli.sh migration test

# 5. Apply migration
./scripts/cli-pipeline/database/database-cli.sh migration run-staged

# 6. Types auto-generated!
```

### Common Patterns

**RLS (Row Level Security)**:
```sql
-- Public read, authenticated write
CREATE POLICY "public_read" ON table_name
  FOR SELECT USING (true);
  
CREATE POLICY "auth_write" ON table_name
  FOR ALL USING (auth.role() = 'authenticated');
```

**Foreign Keys**:
```sql
ALTER TABLE child_table
ADD CONSTRAINT fk_child_parent
FOREIGN KEY (parent_id) 
REFERENCES parent_table(id) 
ON DELETE CASCADE;
```

**Indexes**:
```sql
-- For lookups
CREATE INDEX idx_table_column 
ON table_name(column_name);

-- For composite searches
CREATE INDEX idx_table_multi 
ON table_name(col1, col2);
```

### Performance Considerations

1. **Missing Indexes** (Priority):
   - `google_drive_files.parent_id`
   - `media_content.file_id`
   - `doc_files.document_type_id`

2. **Large Tables** (Monitor):
   - `google_drive_files` (15,000+ records)
   - `media_content` (5,000+ records)

3. **Empty Tables** (Implement):
   - All `learn_*` tables
   - Email system tables
   - Google sync tracking

### Database CLI Commands

```bash
# Show table info
./scripts/cli-pipeline/database/database-cli.sh tables list

# Check migrations
./scripts/cli-pipeline/database/database-cli.sh migrations status

# Generate types manually
pnpm supabase gen types typescript --project-id jdksnfkupzywjdfefkyj > supabase/types.ts

# Validate schema
./scripts/cli-pipeline/database/database-cli.sh schema validate
```

### Troubleshooting

**Problem**: Table name doesn't follow conventions  
**Solution**: Create migration to rename, update `sys_table_migrations`

**Problem**: Types out of sync  
**Solution**: Run type generation command after migrations

**Problem**: Can't find related tables  
**Solution**: Use prefix to group - all `auth_*` tables are together

**Problem**: Migration failed  
**Solution**: Check `sys_table_migrations` for rollback info

### Future Enhancements

1. **Notification System**:
   ```sql
   CREATE TABLE notify_notifications (
     id UUID PRIMARY KEY,
     user_id UUID REFERENCES auth_users(id),
     type VARCHAR(50),
     title TEXT,
     message TEXT,
     read_at TIMESTAMP,
     created_at TIMESTAMP DEFAULT NOW()
   );
   ```

2. **Audit Trail**:
   ```sql
   CREATE TABLE sys_audit_log (
     id UUID PRIMARY KEY,
     table_name VARCHAR(100),
     record_id UUID,
     action VARCHAR(20),
     changes JSONB,
     user_id UUID,
     created_at TIMESTAMP DEFAULT NOW()
   );
   ```

### Related Documentation

**Archived Specs**:
- `database-architecture-evaluation.md` - Original analysis
- `database-table-naming-guide.md` - Naming convention details
- `database-table-prefix-strategy.md` - Prefix strategy design
- `database-prefix-migration-phase1-details.md` - Migration execution

**Active References**:
- `database-maintenance-guide.md` - Ongoing maintenance procedures
- `/supabase/types.ts` - Current schema types
- `/supabase/migrations/` - All migration files

**Code References**:
- `scripts/cli-pipeline/database/` - Database management CLI
- `supabase/migrations/20250527000000_create_table_migration_tracking.sql` - Migration tracking setup
- `packages/shared/services/database-helper.ts` - Common database utilities

---

*This is part of the continuously updated documentation system. It is reviewed every 14 days to ensure accuracy and relevance.*