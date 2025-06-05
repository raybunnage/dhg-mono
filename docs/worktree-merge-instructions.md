# Worktree Merge Instructions with pnpm-lock.yaml Handling

## For Feature Branches (All worktrees except dhg-mono)

Follow these steps carefully to merge your feature branch into development and then update with the latest development changes:

### Phase 1: Merge Your Feature into Development

```bash
# 1. Ensure all files are checked in
git status
git add .
git commit -m "Your commit message"

# 2. Switch to the main dhg-mono repository
cd ~/Documents/github/dhg-mono

# 3. Checkout development branch and update it
git checkout development
git pull origin development

# 4. Merge your feature branch
git merge your-feature-branch

# 5. If there are conflicts with pnpm-lock.yaml:
# Accept the incoming version and regenerate
git checkout --theirs pnpm-lock.yaml
git add pnpm-lock.yaml
pnpm install  # This regenerates the lock file with all dependencies

# 6. Complete the merge
git commit -m "Merge branch 'your-feature-branch' into development"
git push origin development
```

### Phase 2: Update Your Worktree with Latest Development

```bash
# 1. Go back to your worktree
cd ~/Documents/github/dhg-mono-your-worktree

# 2. Ensure your feature branch is clean
git status
git add .
git commit -m "WIP: Before updating from development" # if needed

# 3. Fetch latest changes
git fetch origin

# 4. Update from development with special handling for pnpm-lock.yaml
# First, backup your current lock file
cp pnpm-lock.yaml pnpm-lock.yaml.backup

# 5. Merge development, accepting remote version for lock file
git merge origin/development

# 6. If there are pnpm-lock.yaml conflicts:
git checkout --theirs pnpm-lock.yaml
git add pnpm-lock.yaml

# 7. Regenerate lock file to ensure consistency
pnpm install

# 8. Complete the merge
git add .
git commit -m "Merge latest development and regenerate pnpm-lock.yaml"
```

## Important Notes

1. **Always regenerate pnpm-lock.yaml** after merges rather than manually resolving conflicts
2. **The lock file should reflect the combined dependencies** from all merged branches
3. **If pnpm install fails**, delete node_modules and pnpm-lock.yaml, then run pnpm install again
4. **Keep backups** of your lock file before major operations

## Simplified One-Line Instruction

For your prompt, you can use this enhanced version:

```
Now first make sure all files are checked in, then carefully merge this branch into development branch (read CLAUDE.md). If pnpm-lock.yaml conflicts arise, accept the incoming version and run 'pnpm install' to regenerate. After successfully merging (and only then), bring the updated development branch with all its changes into this worktree, again handling pnpm-lock.yaml by accepting remote and regenerating with 'pnpm install'.
```