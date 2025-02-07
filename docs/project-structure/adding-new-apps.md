# Adding New Apps from Lovable

## Quick Process
1. Generate your app in Lovable
2. Copy only source-controlled files to file_types
3. Review and modify files as needed
4. Copy to your apps directory

## Detailed Steps

### 1. Generate in Lovable
Generate your app as normal in Lovable

### 2. Copy Source Files
Use the copy script:
```bash
# If your lovable app is in Documents/github
pnpm copy-app ~/Documents/github/lovable-app my-new-app

# Or if using full path:
pnpm copy-app /Users/yourusername/Documents/github/lovable-app my-new-app
```

### 3. Review Files
The files will be in `file_types/my-new-app/` for review. This will only include:
- Source code files
- Configuration files
- Other tracked files

### 4. Copy to Apps
After review, copy to your apps directory:
```bash
cp -r file_types/my-new-app apps/dhg-new-app
```

### 5. Update Configuration
- Update package.json name
- Update any paths/references
- Run pnpm install