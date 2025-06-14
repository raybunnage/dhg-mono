# AI Page Buttons Fix

## Issue
The three action buttons on the AI page were not working:
- "Check All Updates"
- "Process All Updates" 
- "List CLI Status"

## Root Cause Analysis

The buttons were correctly implemented with `onClick` handlers and state management, but the API calls were failing due to server availability issues:

1. **Primary Issue**: The `runCLICommand` function was calling `http://localhost:3008/api/cli-command` (continuous docs server)
2. **Server Dependencies**: The continuous docs server may not always be running or available
3. **No Fallback**: There was no fallback mechanism if the primary server failed

## Solution Implemented

### Enhanced Error Handling with Fallback
Modified the `runCLICommand` function to implement a robust fallback strategy:

1. **Primary Attempt**: Try the dedicated continuous docs server on port 3008
2. **Fallback Mechanism**: If the primary server fails, use the git-api-server on port 3009
3. **Proper Error Handling**: Display meaningful error messages to users

### Technical Details

**Primary Server (Port 3008)**:
- Endpoint: `http://localhost:3008/api/cli-command`
- Payload: `{ command, docId }`
- Server: `apps/dhg-admin-code/continuous-docs-server.cjs`

**Fallback Server (Port 3009)**:
- Endpoint: `http://localhost:3009/api/execute-command`
- Payload: `{ command: './scripts/cli-pipeline/continuous_docs/continuous-docs-cli.sh', args: [...] }`
- Server: `apps/dhg-admin-code/git-api-server.cjs`

### Command Mapping
The implementation correctly maps button commands to CLI arguments:

- **Check All Updates** → `check-updates`
- **Process All Updates** → `process-updates`  
- **List CLI Status** → `list-monitored`

### Enhanced Features
- **Real-time Feedback**: Status messages show command progress
- **Loading States**: Buttons show spinning icons during execution
- **Error Display**: Failed commands show detailed error messages
- **Auto-refresh**: Document list refreshes after successful updates

## Files Modified
- `apps/dhg-admin-code/src/pages/AIPage.tsx` - Enhanced runCLICommand with fallback logic

## How It Works Now

1. **User clicks button** → Loading state activates
2. **Primary attempt** → Try continuous docs server (port 3008)
3. **If primary fails** → Fallback to git-api-server (port 3009)
4. **Success** → Display output and refresh data
5. **Failure** → Display error message with details

## Testing the Fix

### Prerequisites
At least one of these servers must be running:
```bash
# Option 1: Start continuous docs server
cd apps/dhg-admin-code && node continuous-docs-server.cjs

# Option 2: Start git-api-server (fallback)
cd apps/dhg-admin-code && node git-api-server.cjs

# Option 3: Start all servers
pnpm servers
```

### Test Procedure
1. Navigate to AI page in dhg-admin-code
2. Click "Check All Updates" button
3. Verify:
   - Button shows loading state
   - Status message appears below buttons
   - Command completes with success/error message
   - Document list refreshes if successful

### Expected Behavior
- **Primary server running**: Fast execution via continuous docs server
- **Only fallback running**: Execution via git-api-server with slightly different output format
- **No servers running**: Clear error message about server availability

## Troubleshooting

### "Command failed: Failed to fetch"
- **Cause**: Neither server is running
- **Solution**: Start at least the git-api-server: `node git-api-server.cjs`

### Commands execute but no output appears
- **Check**: Browser console for errors
- **Verify**: Server logs show command execution
- **Ensure**: Commands are returning valid output

### Fallback always used
- **Check**: Continuous docs server status on port 3008
- **Verify**: CORS configuration allows requests from AI page
- **Test**: Direct API call to `http://localhost:3008/api/cli-command`

## Future Enhancements

1. **Server Status Indicator**: Show which server is being used
2. **Command History**: Keep track of recent command executions
3. **Batch Operations**: Allow multiple commands in sequence
4. **Real-time Logs**: Stream command output as it executes