# Deprecation Process Guide

## Overview

This guide outlines the systematic approach to identifying, evaluating, and deprecating unused code, services, scripts, and commands in the DHG monorepo. The process ensures safe removal of technical debt while maintaining system stability.

## Table of Contents

1. [Deprecation Philosophy](#deprecation-philosophy)
2. [Deprecation Stages](#deprecation-stages)
3. [Evaluation Process](#evaluation-process)
4. [Implementation Process](#implementation-process)
5. [Monitoring & Rollback](#monitoring--rollback)
6. [Tools & Commands](#tools--commands)
7. [Best Practices](#best-practices)

## Deprecation Philosophy

### Why Deprecate?

- **Reduce Complexity**: Unused code increases cognitive load
- **Improve Performance**: Less code to load, parse, and maintain
- **Security**: Fewer attack surfaces and dependencies to manage
- **Developer Experience**: Cleaner codebase is easier to navigate
- **Cost Reduction**: Less storage, fewer dependencies, reduced CI/CD time

### When NOT to Deprecate

- **Core Utilities**: Even if unused, may be needed for future features
- **Recent Code**: Give new features time to be adopted (90+ days)
- **High Historical Usage**: Code with significant past usage needs careful review
- **Cross-Cutting Concerns**: Authentication, logging, error handling services

## Deprecation Stages

### 1. Evaluation Stage
Identify candidates for deprecation through automated analysis:

```bash
# Analyze all deprecation candidates
./scripts/cli-pipeline/deprecation/deprecation-cli.sh generate-report

# Analyze specific types
./scripts/cli-pipeline/deprecation/deprecation-cli.sh analyze-services
./scripts/cli-pipeline/deprecation/deprecation-cli.sh analyze-scripts
./scripts/cli-pipeline/deprecation/deprecation-cli.sh analyze-commands
```

**Evaluation Criteria:**
- **Services**: No dependencies detected in any app or pipeline
- **Scripts**: Not run in 90+ days or never executed
- **Commands**: Less than 5 uses in 90 days
- **Pipelines**: No active commands or recent usage

### 2. Review Stage
Manual review of candidates with stakeholder input:

1. **Check Historical Context**
   - Review git history for creation reason
   - Check related PRs and issues
   - Look for documentation mentions

2. **Verify No Hidden Dependencies**
   - Search codebase for string references
   - Check configuration files
   - Review deployment scripts

3. **Categorize by Risk**
   - **Low Risk**: Never used, no dependencies
   - **Medium Risk**: Minimal usage, few dependencies
   - **High Risk**: Historical usage, unclear dependencies

### 3. Deprecation Stage
Mark items as deprecated and communicate changes:

```bash
# Mark item as deprecated
./scripts/cli-pipeline/deprecation/deprecation-cli.sh mark-deprecated \
  --type service \
  --name OldService \
  --reason "No usage in 6 months, replaced by NewService"
```

**Communication Steps:**
1. Update status in database to 'deprecated'
2. Add deprecation notices to code
3. Update documentation
4. Notify team via appropriate channels

### 4. Migration Stage
Provide migration path for any remaining users:

```bash
# Generate migration plan
./scripts/cli-pipeline/deprecation/deprecation-cli.sh generate-migration
```

**Migration Components:**
- Clear timeline (typically 30-90 days)
- Migration guide documentation
- Alternative solutions
- Support contact information

### 5. Archive Stage
Final removal and archiving:

```bash
# Archive deprecated items
./scripts/cli-pipeline/deprecation/deprecation-cli.sh archive-service --name OldService
./scripts/cli-pipeline/deprecation/deprecation-cli.sh archive-script --path old-script.ts
```

**Archive Process:**
- Move to `.archived_*` directories
- Append date to filenames
- Update all references
- Create archive documentation

## Evaluation Process

### Automated Analysis

The deprecation analysis system uses multiple data sources:

1. **Service Dependencies** (via `registry_unused_services_view`)
   - Tracks imports and usage across all apps and pipelines
   - Identifies truly orphaned services

2. **Script Execution History** (via `scripts_registry`)
   - Last run timestamp
   - Total run count
   - Success/failure rates

3. **Command Usage Analytics** (via `command_tracking`)
   - Usage frequency
   - Error rates
   - User patterns
   - Performance metrics

4. **Pipeline Activity** (via `command_pipelines`)
   - Active command count
   - Last command execution
   - Pipeline dependencies

### Manual Review Process

For items flagged for review:

1. **Code Archaeology**
   ```bash
   # Check creation context
   git log --follow path/to/file
   git blame path/to/file
   
   # Search for references
   grep -r "ServiceName" --include="*.ts" --include="*.tsx"
   ```

2. **Documentation Check**
   - README files
   - CLAUDE.md mentions
   - Technical specifications
   - User guides

3. **Team Consultation**
   - Original authors
   - Current maintainers
   - End users

## Implementation Process

### Phase 1: Mark Deprecated

```typescript
// Add to service
/**
 * @deprecated Since version 2.0. Use NewService instead.
 * Will be removed in version 3.0.
 */
export class OldService {
  constructor() {
    console.warn('OldService is deprecated. Use NewService instead.');
  }
}
```

### Phase 2: Update Dependencies

1. **Find All References**
   ```bash
   # Use the UI to see dependencies
   # Navigate to: /service-dependencies
   
   # Or use CLI
   grep -r "OldService" apps/ packages/ scripts/
   ```

2. **Update Imports**
   ```typescript
   // Before
   import { OldService } from '@shared/services/old-service';
   
   // After
   import { NewService } from '@shared/services/new-service';
   ```

### Phase 3: Archive

```bash
# Services
mv packages/shared/services/old-service \
   packages/shared/services/.archived_services/old-service.20250607

# Scripts
mkdir -p scripts/cli-pipeline/domain/.archived_scripts
mv scripts/cli-pipeline/domain/old-script.ts \
   scripts/cli-pipeline/domain/.archived_scripts/old-script.20250607.ts

# Update .gitignore if needed
echo ".archived_*" >> .gitignore
```

## Monitoring & Rollback

### Continuous Monitoring

```bash
# Monitor deprecated item usage
./scripts/cli-pipeline/deprecation/deprecation-cli.sh monitor-usage

# Check health of deprecation tracking
./scripts/cli-pipeline/deprecation/deprecation-cli.sh health-check

# View usage trends
./scripts/cli-pipeline/deprecation/deprecation-cli.sh usage-trends
```

### Rollback Process

If issues arise after deprecation:

1. **Immediate Rollback**
   ```bash
   # Restore from archive
   mv .archived_services/service-name.20250607 service-name
   
   # Update status
   ./scripts/cli-pipeline/deprecation/deprecation-cli.sh mark-deprecated \
     --type service \
     --name ServiceName \
     --status active
   ```

2. **Communicate Rollback**
   - Update team
   - Document reasons
   - Plan revised approach

## Tools & Commands

### UI Dashboard
Navigate to `/deprecation-analysis` for visual analysis:
- Real-time deprecation candidates
- Usage statistics
- Dependency graphs
- Export capabilities

### CLI Commands

**Evaluation Commands:**
```bash
analyze-services     # Analyze unused services
analyze-scripts      # Analyze inactive scripts
analyze-commands     # Analyze low-usage CLI commands
analyze-pipelines    # Analyze pipeline usage patterns
generate-report      # Generate comprehensive report
```

**Operation Commands:**
```bash
mark-deprecated      # Mark items for deprecation
archive-service      # Archive a deprecated service
archive-script       # Archive a deprecated script
deprecate-command    # Deprecate a CLI command
generate-migration   # Generate migration plan
```

**Monitoring Commands:**
```bash
monitor-usage        # Monitor usage of deprecated items
health-check         # Check deprecation tracking health
usage-trends         # Show usage trends
```

## Best Practices

### 1. Start Small
- Begin with obviously unused items
- Build confidence in the process
- Learn from each deprecation

### 2. Document Everything
- Reason for deprecation
- Migration path
- Rollback procedures
- Lessons learned

### 3. Communicate Early
- Announce deprecation plans
- Provide ample notice period
- Offer migration support

### 4. Monitor Continuously
- Track usage after deprecation
- Watch for unexpected dependencies
- Be ready to rollback

### 5. Archive, Don't Delete
- Keep code accessible for reference
- Maintain git history
- Enable easy restoration

### 6. Regular Cleanup Cycles
- Quarterly deprecation reviews
- Annual archive audits
- Continuous monitoring

## Common Patterns

### Service Deprecation Pattern
```bash
# 1. Analyze
./deprecation-cli.sh analyze-services

# 2. Review output, then mark
./deprecation-cli.sh mark-deprecated --type service --name OldAuth

# 3. Update code
# Add @deprecated JSDoc
# Add console warnings

# 4. Wait notice period (30 days)

# 5. Archive
./deprecation-cli.sh archive-service --name OldAuth
```

### Script Consolidation Pattern
When multiple scripts do similar things:

1. Identify overlapping functionality
2. Create consolidated version
3. Deprecate individual scripts
4. Update references
5. Archive after migration period

### Command Migration Pattern
```typescript
// In CLI handler
case 'old-command':
  console.warn('⚠️  old-command is deprecated. Use new-command instead.');
  console.warn('   old-command will be removed in version 3.0');
  // Still execute for compatibility
  handleOldCommand();
  break;
```

## Metrics & Success Criteria

### Key Metrics
- **Code Reduction**: Lines of code removed
- **Dependency Reduction**: Number of dependencies eliminated
- **Performance Impact**: Load time improvements
- **Developer Velocity**: Time saved in navigation/comprehension

### Success Indicators
- No production issues from deprecation
- Positive developer feedback
- Reduced CI/CD time
- Cleaner dependency graph
- Improved documentation quality

## Conclusion

Deprecation is an ongoing process that requires careful planning, clear communication, and systematic execution. By following this guide, we can safely remove technical debt while maintaining system stability and developer trust.

Remember: **When in doubt, mark for review rather than immediate deprecation.**