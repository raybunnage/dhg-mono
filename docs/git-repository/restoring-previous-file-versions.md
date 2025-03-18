# Restoring Previous File Versions with Git

## Use Case: Reverting a Broken Script File

Sometimes a working script file stops functioning after recent changes. Rather than trying to debug and fix the current version, it can be more efficient to revert to a previously working version. This document outlines the process for identifying and restoring a specific file from a previous commit.

## Quick Reference: Complete Command Sequence

Here's the complete sequence of commands to restore a file from a previous commit:

```bash
# 1. View recent commit history for the specific file
git log -n 5 --pretty=format:"%h - %an, %ar : %s" -- path/to/file.sh

# real things Example: View recent commit history for the markdown report script
git log -n 5 --pretty=format:"%h - %an, %ar : %s" -- scripts/markdown-report.sh


git log -n 5 --pretty=format:"%h - %an, %ar : %s" -- scripts/script-report.sh

git log -n 5 --pretty=format:"%h - %an, %ar : %s" -- scripts/validate-ai-assets.sh



git log -n 5 --pretty=format:"%h - %an, %ar : %s" -- apps/dhg-improve-experts/src/pages/ClassifyDocument.tsx

# 2. Examine detailed changes to identify the last working version
git log -n 5 -p -- path/to/file.sh

# 3. Restore the file from the identified commit
git checkout abc123 -- path/to/file.sh

# real things Example: Restore the markdown report script from commit 91272de
git checkout 12d3da3 -- scripts/markdown-report.sh

git checkout db9d4fd -- scripts/script-report.sh

git checkout be29a29 -- apps/dhg-improve-experts/src/pages/ClassifyDocument.tsx

git checkout be29a29 -- apps/dhg-improve-experts/src/utils/ai-processing.ts

git checkout cb40e97 -- scripts/validate-ai-assets.sh


git log -n 5 --pretty=format:"%h - %an, %ar : %s" -- apps/dhg-improve-experts/src/utils/ai-processing.ts

# 4. Make the file executable (if it's a script)
chmod +x path/to/file.sh

# 5. Test the restored file
./path/to/file.sh

# 6. Commit the restored file
git add path/to/file.sh
git commit -m "Restore working version of file.sh from commit abc123"
```

Replace `abc123` with the actual commit hash of the last working version, and `path/to/file.sh` with the actual file path.

## Step 1: Identify When the File Changed

First, you need to see the recent history of changes to the specific file:

```bash
# View the last 5 commits that modified a specific file
git log -n 5 --pretty=format:"%h - %an, %ar : %s" -- path/to/file.sh
```

Example output:
```
a1b2c3d - Ray Bunnage, 2 hours ago : Update script to handle edge cases
e5f6g7h - Ray Bunnage, 1 day ago : Fix path handling in script
i9j0k1l - Ray Bunnage, 2 days ago : Add new feature to script
m2n3o4p - Ray Bunnage, 1 week ago : Initial script implementation
q5r6s7t - Ray Bunnage, 1 week ago : Add script template
```

## Step 2: Examine the Changes in Detail

To see exactly what changed in each commit:

```bash
# View detailed changes in the last 5 commits for this file
git log -n 5 -p -- path/to/file.sh
```

This shows the actual code changes (patches) for each commit, helping you identify which commit likely introduced the problem.

## Step 3: Restore the File from a Specific Commit

Once you've identified the last working version, restore the file from that commit:

```bash
# Replace abc123 with the actual commit hash you want to restore
git checkout abc123 -- path/to/file.sh
```

This command:
- Extracts just that one file from the specified commit
- Overwrites your current version with the historical version
- Stages the change in your working directory
- Doesn't affect any other files or change your current branch

## Step 4: Test and Commit the Restored File

After restoring the file:

1. Make it executable if needed:
   ```bash
   chmod +x path/to/file.sh
   ```

2. Test to ensure it works as expected:
   ```bash
   ./path/to/file.sh
   ```

3. Commit the restored file:
   ```bash
   git add path/to/file.sh
   git commit -m "Restore working version of file.sh from commit abc123"
   ```

## Real-World Example

Here's a concrete example using a markdown report script:

```bash
# 1. View recent history of the markdown report script
git log -n 5 --pretty=format:"%h - %an, %ar : %s" -- scripts/markdown-report.sh

# Example output:
# 7a8b9c0 - Ray Bunnage, 3 hours ago : Fix prompts folder detection
# 1d2e3f4 - Ray Bunnage, 1 day ago : Update script to handle new file types
# 5g6h7i8 - Ray Bunnage, 3 days ago : Add support for prompts folder
# 9j0k1l2 - Ray Bunnage, 1 week ago : Initial implementation of markdown report

# 2. Examine changes in detail to find where it broke
git log -n 5 -p -- scripts/markdown-report.sh

# 3. Restore from the last working version (5g6h7i8 in this example)
git checkout 5g6h7i8 -- scripts/markdown-report.sh

# 4. Make executable
chmod +x scripts/markdown-report.sh

# 5. Test the script
./scripts/markdown-report.sh

# 6. Commit the restored version
git add scripts/markdown-report.sh
git commit -m "Restore working version of markdown-report.sh from commit 5g6h7i8"
```

## Additional Options

### View File at a Specific Commit Without Restoring

To just examine a file as it existed in a previous commit without restoring it:

```bash
git show abc123:path/to/file.sh
```

### Compare Current Version with Previous Version

To see differences between current version and a previous version:

```bash
git diff abc123 -- path/to/file.sh
```

### Restore a File That Was Deleted

If the file was completely deleted in a recent commit:

```bash
git checkout abc123 -- path/to/file.sh
```

Where `abc123` is the last commit where the file still existed.

## Best Practices

1. **Document the Restoration**: Include the original commit hash in your commit message when restoring a file.

2. **Understand Why It Broke**: After restoring, consider reviewing what broke the file to prevent similar issues.

3. **Consider Creating a Branch**: If you're unsure about restoring, create a branch first:
   ```bash
   git checkout -b restore-script-file
   git checkout abc123 -- path/to/file.sh
   # Test the file
   git checkout main  # Return to main branch if restoration didn't work
   # Or merge if it did work
   git checkout main
   git merge restore-script-file
   ```

4. **Use Tags for Important Versions**: For critical scripts, consider tagging known-good versions:
   ```bash
   git tag script-v1-working abc123
   ```
   Then you can restore using:
   ```bash
   git checkout script-v1-working -- path/to/file.sh
   ``` 