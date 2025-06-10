# Git History Analysis Server

**Last Updated**: 2025-01-09  
**Next Review**: Tomorrow (Daily Review)  
**Status**: Active  
**Priority**: High  

## Summary

The Git History Analysis Server provides a web interface and API for analyzing git commit history and automatically assigning worktrees to completed tasks based on commit patterns, temporal analysis, and content matching.

## Current State

- **Server Location**: `scripts/cli-pipeline/dev_tasks/git-history-server.js`
- **Port**: 3011 (configurable via GIT_HISTORY_PORT env var)
- **Status**: Newly created, ready for testing
- **Integration**: Works with `assign-worktrees.ts` CLI command

## Features

### Web Interface
- Visual dashboard for git history analysis
- One-click worktree assignment
- Real-time statistics and metrics
- Assignment confidence visualization

### API Endpoints
- `GET /api/analyze-history` - Analyze git commit patterns
- `POST /api/assign-worktrees` - Run automatic assignment
- `GET /api/worktree-stats` - Get worktree task statistics

### Key Capabilities
1. **Commit Analysis**
   - Counts commits with/without Task IDs
   - Shows sample of untagged commits
   - Lists active worktrees

2. **Automatic Assignment**
   - Runs the assign-worktrees CLI command
   - Shows assignment metrics
   - Displays confidence levels

3. **Statistics**
   - Tasks per worktree
   - Completion status breakdown
   - Commit counts by worktree

## Technical Implementation

### Dependencies
- Express.js for web server
- CORS enabled for frontend access
- Integrates with Supabase for data
- Uses git CLI commands for analysis

### Architecture
```
Git History Server (Port 3011)
├── Web Interface (HTML/JS)
├── REST API
│   ├── /api/analyze-history
│   ├── /api/assign-worktrees
│   └── /api/worktree-stats
└── CLI Integration
    └── assign-worktrees.ts
```

## Usage

### Starting the Server
```bash
# Start directly
node scripts/cli-pipeline/dev_tasks/git-history-server.js

# Or with custom port
GIT_HISTORY_PORT=3012 node scripts/cli-pipeline/dev_tasks/git-history-server.js

# Or via central server manager
pnpm servers
```

### Web Interface
1. Navigate to http://localhost:3011
2. Click "Analyze Git History" to see current state
3. Click "Assign Worktrees" to run assignment
4. Click "Get Worktree Stats" for statistics

### API Usage
```bash
# Analyze history
curl http://localhost:3011/api/analyze-history

# Run assignment
curl -X POST http://localhost:3011/api/assign-worktrees

# Get statistics
curl http://localhost:3011/api/worktree-stats
```

## Integration Points

### With Dev Tasks System
- Updates `dev_tasks` table with worktree assignments
- Tracks assignment metadata (method, confidence, reason)
- Creates entries in `dev_task_commit_analysis` table

### With Worktree Pills UI
- Provides data for worktree filtering in TasksPage
- Enables accurate task counts per worktree
- Supports 3-state completion filtering

## Configuration

### Environment Variables
- `GIT_HISTORY_PORT` - Server port (default: 3011)
- Standard Supabase env vars for database access

### Port Assignment
- Reserved port 3011 in monorepo port allocation
- Added to `start-all-servers.js` for central management

## Monitoring & Maintenance

### Health Checks
- Server status available at root endpoint
- API endpoints return error states gracefully
- Logs git command execution results

### Common Issues
1. **Port conflicts**: Change port via env var
2. **Git access**: Ensure server runs from git repo
3. **Database access**: Check Supabase credentials

## Future Enhancements

### Planned Features
1. **Real-time Updates**
   - WebSocket support for live updates
   - Auto-refresh statistics

2. **Enhanced Analysis**
   - Machine learning for better assignment
   - Pattern recognition improvements

3. **Bulk Operations**
   - Batch assignment controls
   - Undo/redo functionality

4. **Reporting**
   - Export assignment history
   - Trend analysis charts

### Integration Opportunities
- Connect with CI/CD pipelines
- Add GitHub webhook support
- Create Slack notifications

## Related Documentation

- [Worktree Assignment System](./worktree-assignment-system.md)
- [Dev Tasks Git Integration](../deployment-environment/enhanced-dev-tasks-git-integration.md)
- [CLI Pipeline Architecture](../cli-pipeline/CLI_PIPELINE_GUIDANCE.md)

## Recent Changes

### 2025-01-09
- Initial server creation
- Added web interface with metrics
- Integrated with assign-worktrees CLI
- Created API endpoints
- Added to port management system

## Next Actions

- [ ] Test server with real data
- [ ] Add to health check monitoring
- [ ] Create automated tests
- [ ] Document API responses in detail
- [ ] Add authentication if needed