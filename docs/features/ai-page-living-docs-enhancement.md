# AI Page Living Docs Enhancement

## Overview
Enhanced the AI page to allow direct management of living documentation update frequencies and trigger CLI pipeline commands from the UI.

## Features Implemented

### 1. ✏️ Frequency Editor
- **Click on any document's frequency** (e.g., "7 day cycle") to edit
- **Inline editor** with save/cancel buttons
- **Updates database immediately** when saved
- **Validates input** (1-365 days)

### 2. 🔄 Check Updates Button
- **New blue button** in the header: "Check Updates"
- **Executes CLI command**: `./scripts/cli-pipeline/continuous_docs/continuous-docs-cli.sh check-updates --verbose`
- **Shows status messages** during execution
- **Refreshes document list** after completion

### 3. 📡 API Integration
- **New endpoint** in git-api-server.cjs: `/api/execute-command`
- **Security**: Whitelisted commands only (continuous_docs CLI)
- **Timeout**: 30 seconds for command execution
- **Error handling**: Returns stdout/stderr for debugging

## Usage

### To Change Update Frequency:
1. Navigate to AI page
2. Find the document you want to update
3. Click on the frequency text (e.g., "7 day cycle")
4. Enter new value in days
5. Click the save icon (✓) to confirm

### To Run Update Check:
1. Navigate to AI page
2. Click "Check Updates" button in the header
3. Watch status message for progress
4. Document list will refresh when complete

### To Start the API Server:
```bash
# The git-api-server must be running for CLI integration
cd apps/dhg-admin-code
node git-api-server.cjs

# Or use the centralized server manager
pnpm servers
```

## Technical Details

### Files Modified:
- `apps/dhg-admin-code/src/pages/AIPage.tsx` - Added UI components and state management
- `apps/dhg-admin-code/git-api-server.cjs` - Added execute-command endpoint

### State Management:
- `editingFrequency` - Tracks which document is being edited
- `frequencyValue` - Temporary value during editing
- `runningUpdate` - Prevents multiple simultaneous updates
- `updateStatus` - Shows user feedback messages

### Security Considerations:
- Only whitelisted commands can be executed
- Commands run with 30-second timeout
- No arbitrary command execution allowed

## Future Enhancements

### Possible additions:
1. **Process Updates button** - Run `process-updates` command
2. **Schedule management** - Set up automated checks
3. **Batch frequency updates** - Update multiple docs at once
4. **Update history** - Show when docs were last checked/updated
5. **Notification system** - Alert when docs need review

## Troubleshooting

### "Failed to run command - is the API server running?"
- Ensure git-api-server is running on port 3009
- Check `pnpm servers` or run manually

### Updates not reflecting
- Refresh the page after making changes
- Check browser console for errors
- Verify database connection

### Command execution fails
- Check that continuous_docs CLI pipeline exists
- Verify you're in the correct working directory
- Check server logs for detailed error messages