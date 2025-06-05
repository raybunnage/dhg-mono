# Clist Worktree Alias Mapping

This document shows the mapping between `clist` aliases and Git worktree paths as displayed in the dhg-admin-code Git Management page.

## Alias to Worktree Mapping

| Alias | Emoji | Name | Worktree Path | Branch (typical) |
|-------|-------|------|---------------|------------------|
| c1/cdev | 🟢 | Development | `/Users/raybunnage/Documents/github/dhg-mono` | development |
| c2/cadmin | 🔵 | Admin Code | `/Users/raybunnage/Documents/github/dhg-mono-admin-code` | feature/improve-prompt-service-add-page |
| c3/chub | 🟣 | Hub | `/Users/raybunnage/Documents/github/dhg-mono-dhg-hub` | feature/improve-dhg-hub |
| c4/cdocs | 🟠 | Docs | `/Users/raybunnage/Documents/github/dhg-mono-feature/dhg-mono-docs` | feature/continuous-documentation-archiving |
| c5/cgmail | 🔴 | Gmail | `/Users/raybunnage/Documents/github/dhg-mono-gmail-cli-pipeline-research-app` | gmail-cli-pipeline-research-app |
| c6/caudio | 🟡 | Audio | `/Users/raybunnage/Documents/github/dhg-mono-improve-audio` | improve-audio |
| c7/ccli | 🔷 | CLI Pipelines | `/Users/raybunnage/Documents/github/dhg-mono-improve-cli-pipelines` | improve-cli-pipelines |
| c8/cgoogle | 🩷 | Google | `/Users/raybunnage/Documents/github/dhg-mono-improve-google` | improve-google |
| c9/csuite | 🟩 | Suite | `/Users/raybunnage/Documents/github/dhg-mono-improve-suite` | improve-suite |
| c0/cfix | 🟪 | Bug Fixes | `/Users/raybunnage/Documents/github/dhg-mono-integration-bug-fixes-tweaks` | integration/bug-fixes-tweaks |

## Usage

### Command Line Navigation
```bash
# List all aliases
clist

# Navigate to a worktree using number alias
c1    # Go to Development worktree
c2    # Go to Admin Code worktree

# Navigate using name alias
cdev    # Go to Development worktree
cadmin  # Go to Admin Code worktree
```

### Git Management Page
The Git Management page in dhg-admin-code now displays these aliases on each worktree card:
- Shows the emoji indicator
- Displays the alias (e.g., "c2/cadmin") in a badge
- Makes it easy to identify which worktree corresponds to which clist command

## Implementation Notes

1. The mapping is defined in `/apps/dhg-admin-code/src/utils/worktree-alias-mapping.ts`
2. Some worktrees have alternate path names in the Git Management defaultWorktrees array
3. The Git Management page uses the `getWorktreeAliasInfo()` function to display aliases
4. If a worktree path doesn't match any alias, it displays without the alias badge

## Adding New Worktrees

To add a new worktree to the mapping:
1. Update the `worktreeAliasMapping` object in `worktree-alias-mapping.ts`
2. Update the `pathToAliasInfo` object with the reverse mapping
3. Update your `.zshrc` clist function to include the new alias
4. The Git Management page will automatically display the new alias