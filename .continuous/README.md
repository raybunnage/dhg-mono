# Continuous Development Standards

This directory contains version-controlled standards for the DHG monorepo.

## Files

### standards.yaml
The main standards configuration file containing:
- **Database Standards**: Table/column naming, required fields, data types
- **Service Standards**: Implementation patterns, environment handling, error handling
- **Testing Standards**: Coverage requirements, test patterns

## Benefits of File-Based Standards

1. **Version Controlled**: Changes go through PR review process
2. **Simple**: Easy to read and understand in YAML format
3. **No Database Dependency**: Standards available even if database is down
4. **IDE Support**: YAML files have excellent editor support
5. **Portable**: Can be shared across projects

## Usage

### Manual Validation
```bash
# Run the standards validator
ts-node scripts/cli-pipeline/utilities/validate-standards.ts
```

### In Code
```typescript
import * as yaml from 'js-yaml';
import * as fs from 'fs';

const standards = yaml.load(
  fs.readFileSync('.continuous/standards.yaml', 'utf8')
);

// Use standards for validation
const requiredColumns = standards.database.columns.required_fields;
```

## Migrating from Database Standards

This approach replaces the following database tables:
- `sys_database_standards`
- `sys_service_standards` 
- `sys_testing_requirements`

The database tables can be archived once all tools are updated to use this file.

## Future Enhancements

1. **Pre-commit Hooks**: Validate changes against standards
2. **CI/CD Integration**: Run validation in pull requests
3. **Auto-fix Tool**: Automatically fix common violations
4. **VS Code Extension**: Real-time validation while coding