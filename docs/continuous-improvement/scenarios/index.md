# Continuous Improvement Scenarios Index

This index tracks all available continuous improvement scenarios. Each scenario captures a repeatable process that can be automated.

## Available Scenarios

| ID | Name | Description | Status | Documentation | Script |
|----|------|-------------|--------|---------------|--------|
| add-new-proxy-server | Add New Proxy Server | Comprehensive process for adding a new proxy server to the system | ✅ Complete | [View](./add-new-proxy-server.md) | [Run](../../../scripts/cli-pipeline/continuous/scenarios/add-new-proxy-server.ts) |
| add-new-shared-service | Add New Shared Service | Create shared services with singleton/DI patterns and cross-env compatibility | ✅ Complete | [View](./add-new-shared-service.md) | - |
| modify-database-tables | Modify Database Tables | Add/modify tables following naming conventions and migration best practices | ✅ Complete | [View](./modify-database-tables.md) | - |
| add-new-app-page | Add New App Page | Add pages to apps with proper routing, services, and UI patterns | ✅ Complete | [View](./add-new-app-page.md) | - |
| add-new-tests | Add New Tests | Add comprehensive tests (unit/integration/e2e) to any component | ✅ Complete | [View](./add-new-tests.md) | - |
| add-new-ui-integration | Add New UI Integration | Steps to integrate a new UI feature across apps | 📝 Planned | - | - |
| database-migration | Database Migration | Safe database migration process | 📝 Planned | - | - |
| refactor-service | Refactor Service | Service refactoring with test preservation | 📝 Planned | - | - |

## Scenario Status Legend

- ✅ Complete - Fully documented with automation script
- 🚧 In Progress - Documentation or script being developed
- 📝 Planned - Identified but not yet documented

## Adding New Scenarios

1. **Identify a repeatable process** that involves multiple manual steps
2. **Document the process** in `docs/continuous-improvement/scenarios/{scenario-id}.md`
3. **Create automation script** in `scripts/cli-pipeline/continuous/scenarios/{scenario-id}.ts`
4. **Update this index** with the new scenario
5. **Test the automation** using `./continuous-cli.sh run-scenario {scenario-id}`

## Scenario Documentation Template

Use this template when creating new scenario documentation:

```markdown
# [Scenario Name]

## Overview
Brief description of what this scenario accomplishes.

## When to Use
- Specific situations where this scenario applies
- Prerequisites or conditions

## Manual Steps
1. Step one with specific commands
2. Step two with file paths
3. Continue until complete

## Validation Checklist
- [ ] Thing to verify after step 1
- [ ] Thing to verify after step 2
- [ ] Final verification

## Common Issues
- Issue 1: Description and solution
- Issue 2: Description and solution

## Automation Notes
- Key patterns to preserve
- Variables that need to be parameterized
- Integration points with other systems
```

## Running Scenarios

```bash
# List all scenarios
./scripts/cli-pipeline/continuous/continuous-cli.sh scenarios

# Run a specific scenario
./scripts/cli-pipeline/continuous/continuous-cli.sh run-scenario add-new-proxy-server test-runner 9892

# Get help for a scenario
./scripts/cli-pipeline/continuous/continuous-cli.sh run-scenario add-new-proxy-server --help
```