# File Management and Version Control Guidelines

## Common Issues
- Multiple versions of components existing simultaneously
- Confusion between archived and active files
- Unaware of existing implementations when creating new ones
- Duplicate functionality across different locations

## Directory Structure Review
Before making changes, always:
1. Request a current tree structure if one hasn't been provided recently
2. Use `pnpm tree` to view current monorepo structure
3. Check for existing implementations in:
   - Current directory
   - Archive directories (`_archive`, `_old`, etc.)
   - Related component directories

## Best Practices
1. **Before Creating New Files**
   - Search entire codebase for similar components
   - Check archive folders for previous versions
   - Review imports to find existing usage

2. **When Modifying Components**
   - Verify you're editing the active version
   - Check for duplicate implementations
   - Look for import references across the project

3. **When Archiving**
   - Move to `_archive` directory with date suffix
   - Update all imports to new location
   - Document the change in a comment

4. **Version Tracking**
   - Add version comments in components
   - Use consistent date format: YYYY-MM-DD
   - Document major changes

## File Location Conventions
- Active components: `/src/components/`
- Archived files: `/src/_archive/`
- Utilities: `/src/utils/`
- Pages: `/src/app/` or `/src/pages/` 