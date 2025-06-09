#!/usr/bin/env node

const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');

const execAsync = promisify(exec);
const app = express();
const PORT = process.env.GIT_HISTORY_PORT || 3011;

// Enable CORS for frontend access
app.use(cors());
app.use(express.json());

// HTML interface
const HTML_INTERFACE = `
<!DOCTYPE html>
<html>
<head>
    <title>Git History Analysis Server</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            margin-bottom: 10px;
        }
        .subtitle {
            color: #666;
            margin-bottom: 30px;
        }
        .actions {
            display: flex;
            gap: 10px;
            margin-bottom: 30px;
        }
        button {
            padding: 10px 20px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        }
        button:hover {
            background: #0056b3;
        }
        button:disabled {
            background: #ccc;
            cursor: not-allowed;
        }
        .status {
            padding: 15px;
            margin-bottom: 20px;
            border-radius: 4px;
            display: none;
        }
        .status.success {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        .status.error {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        .status.info {
            background: #d1ecf1;
            color: #0c5460;
            border: 1px solid #bee5eb;
        }
        .results {
            margin-top: 20px;
        }
        .result-section {
            margin-bottom: 30px;
        }
        .result-section h3 {
            color: #333;
            margin-bottom: 10px;
        }
        .metrics {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        }
        .metric {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 4px;
            border: 1px solid #dee2e6;
        }
        .metric-value {
            font-size: 24px;
            font-weight: bold;
            color: #007bff;
        }
        .metric-label {
            color: #666;
            font-size: 14px;
        }
        pre {
            background: #f4f4f4;
            padding: 15px;
            border-radius: 4px;
            overflow-x: auto;
            font-size: 13px;
        }
        .task-item {
            background: #f8f9fa;
            padding: 10px;
            margin-bottom: 10px;
            border-radius: 4px;
            border: 1px solid #dee2e6;
        }
        .task-title {
            font-weight: bold;
            color: #333;
        }
        .task-meta {
            font-size: 12px;
            color: #666;
            margin-top: 5px;
        }
        .confidence-high { color: #28a745; }
        .confidence-medium { color: #ffc107; }
        .confidence-low { color: #dc3545; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Git History Analysis Server</h1>
        <p class="subtitle">Analyze git commits and assign worktrees to completed tasks</p>
        
        <div class="actions">
            <button onclick="analyzeGitHistory()">Analyze Git History</button>
            <button onclick="assignWorktrees()">Assign Worktrees</button>
            <button onclick="getWorktreeStats()">Get Worktree Stats</button>
        </div>
        
        <div id="status" class="status"></div>
        <div id="results" class="results"></div>
    </div>
    
    <script>
        function showStatus(message, type = 'info') {
            const status = document.getElementById('status');
            status.className = 'status ' + type;
            status.textContent = message;
            status.style.display = 'block';
        }
        
        function showResults(html) {
            document.getElementById('results').innerHTML = html;
        }
        
        async function analyzeGitHistory() {
            showStatus('Analyzing git history...', 'info');
            showResults('');
            
            try {
                const response = await fetch('/api/analyze-history');
                const data = await response.json();
                
                if (data.error) {
                    showStatus('Error: ' + data.error, 'error');
                    return;
                }
                
                let html = '<div class="result-section">';
                html += '<h3>Git History Analysis</h3>';
                
                // Show metrics
                html += '<div class="metrics">';
                html += '<div class="metric"><div class="metric-value">' + data.totalCommits + '</div><div class="metric-label">Total Commits</div></div>';
                html += '<div class="metric"><div class="metric-value">' + data.commitsWithTaskIds + '</div><div class="metric-label">With Task IDs</div></div>';
                html += '<div class="metric"><div class="metric-value">' + data.commitsWithoutTaskIds + '</div><div class="metric-label">Without Task IDs</div></div>';
                html += '<div class="metric"><div class="metric-value">' + data.worktrees.length + '</div><div class="metric-label">Active Worktrees</div></div>';
                html += '</div>';
                
                // Show worktrees
                html += '<h4>Active Worktrees:</h4>';
                html += '<ul>';
                data.worktrees.forEach(wt => {
                    html += '<li>' + wt.name + ' (' + wt.path + ')</li>';
                });
                html += '</ul>';
                
                // Show sample commits
                if (data.sampleCommits && data.sampleCommits.length > 0) {
                    html += '<h4>Recent Commits Without Task IDs:</h4>';
                    data.sampleCommits.forEach(commit => {
                        html += '<div class="task-item">';
                        html += '<div class="task-title">' + commit.subject + '</div>';
                        html += '<div class="task-meta">' + commit.hash.substring(0, 7) + ' - ' + commit.author + ' - ' + commit.date + '</div>';
                        html += '</div>';
                    });
                }
                
                html += '</div>';
                showResults(html);
                showStatus('Analysis complete', 'success');
            } catch (error) {
                showStatus('Error: ' + error.message, 'error');
            }
        }
        
        async function assignWorktrees() {
            showStatus('Assigning worktrees to tasks...', 'info');
            showResults('');
            
            try {
                const response = await fetch('/api/assign-worktrees', { method: 'POST' });
                const data = await response.json();
                
                if (data.error) {
                    showStatus('Error: ' + data.error, 'error');
                    return;
                }
                
                let html = '<div class="result-section">';
                html += '<h3>Worktree Assignment Results</h3>';
                
                // Show metrics
                html += '<div class="metrics">';
                html += '<div class="metric"><div class="metric-value">' + data.tasksAnalyzed + '</div><div class="metric-label">Tasks Analyzed</div></div>';
                html += '<div class="metric"><div class="metric-value">' + data.tasksAssigned + '</div><div class="metric-label">Tasks Assigned</div></div>';
                html += '<div class="metric"><div class="metric-value">' + data.highConfidence + '</div><div class="metric-label">High Confidence</div></div>';
                html += '<div class="metric"><div class="metric-value">' + data.mediumConfidence + '</div><div class="metric-label">Medium Confidence</div></div>';
                html += '</div>';
                
                // Show assignments
                if (data.assignments && data.assignments.length > 0) {
                    html += '<h4>New Assignments:</h4>';
                    data.assignments.forEach(assignment => {
                        const confidenceClass = assignment.confidence >= 80 ? 'confidence-high' : 
                                              assignment.confidence >= 50 ? 'confidence-medium' : 'confidence-low';
                        html += '<div class="task-item">';
                        html += '<div class="task-title">' + assignment.title + '</div>';
                        html += '<div class="task-meta">';
                        html += 'Assigned to: ' + assignment.worktree + ' | ';
                        html += 'Method: ' + assignment.method + ' | ';
                        html += '<span class="' + confidenceClass + '">Confidence: ' + assignment.confidence + '%</span>';
                        html += '</div>';
                        html += '</div>';
                    });
                }
                
                // Show output
                if (data.output) {
                    html += '<h4>Command Output:</h4>';
                    html += '<pre>' + data.output + '</pre>';
                }
                
                html += '</div>';
                showResults(html);
                showStatus('Assignment complete', 'success');
            } catch (error) {
                showStatus('Error: ' + error.message, 'error');
            }
        }
        
        async function getWorktreeStats() {
            showStatus('Loading worktree statistics...', 'info');
            showResults('');
            
            try {
                const response = await fetch('/api/worktree-stats');
                const data = await response.json();
                
                if (data.error) {
                    showStatus('Error: ' + data.error, 'error');
                    return;
                }
                
                let html = '<div class="result-section">';
                html += '<h3>Worktree Statistics</h3>';
                
                // Show stats for each worktree
                data.stats.forEach(stat => {
                    html += '<h4>' + stat.worktree + '</h4>';
                    html += '<div class="metrics">';
                    html += '<div class="metric"><div class="metric-value">' + stat.totalTasks + '</div><div class="metric-label">Total Tasks</div></div>';
                    html += '<div class="metric"><div class="metric-value">' + stat.completedTasks + '</div><div class="metric-label">Completed</div></div>';
                    html += '<div class="metric"><div class="metric-value">' + stat.inProgressTasks + '</div><div class="metric-label">In Progress</div></div>';
                    html += '<div class="metric"><div class="metric-value">' + stat.commits + '</div><div class="metric-label">Commits</div></div>';
                    html += '</div>';
                });
                
                html += '</div>';
                showResults(html);
                showStatus('Statistics loaded', 'success');
            } catch (error) {
                showStatus('Error: ' + error.message, 'error');
            }
        }
    </script>
</body>
</html>
`;

// Routes
app.get('/', (req, res) => {
    res.send(HTML_INTERFACE);
});

// Analyze git history
app.get('/api/analyze-history', async (req, res) => {
    try {
        // Get worktrees
        const { stdout: worktreeOutput } = await execAsync('git worktree list --porcelain');
        const worktrees = [];
        const lines = worktreeOutput.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('worktree ')) {
                const path = lines[i].substring(9);
                const name = path.split('/').pop();
                worktrees.push({ name, path });
            }
        }
        
        // Count commits with and without Task IDs
        const { stdout: totalCount } = await execAsync('git rev-list --count HEAD');
        const { stdout: withTaskCount } = await execAsync('git log --grep="Task: #" --format=oneline | wc -l');
        
        const totalCommits = parseInt(totalCount.trim());
        const commitsWithTaskIds = parseInt(withTaskCount.trim());
        const commitsWithoutTaskIds = totalCommits - commitsWithTaskIds;
        
        // Get sample of recent commits without Task IDs
        const { stdout: sampleCommits } = await execAsync(
            'git log --grep="Task: #" --invert-grep --format="%H|%s|%an|%ad" --date=short -n 10'
        );
        
        const commits = sampleCommits.trim().split('\n').filter(line => line).map(line => {
            const [hash, subject, author, date] = line.split('|');
            return { hash, subject, author, date };
        });
        
        res.json({
            totalCommits,
            commitsWithTaskIds,
            commitsWithoutTaskIds,
            worktrees,
            sampleCommits: commits
        });
    } catch (error) {
        res.json({ error: error.message });
    }
});

// Assign worktrees
app.post('/api/assign-worktrees', async (req, res) => {
    try {
        const scriptPath = path.join(__dirname, 'commands', 'assign-worktrees.ts');
        const { stdout, stderr } = await execAsync(`ts-node ${scriptPath}`);
        
        // Parse output for metrics
        const output = stdout + stderr;
        const tasksAnalyzed = (output.match(/Analyzing (\d+) completed tasks/) || [0, 0])[1];
        const tasksAssigned = (output.match(/Successfully assigned (\d+) tasks/) || [0, 0])[1];
        const highConfidence = (output.match(/High confidence: (\d+)/) || [0, 0])[1];
        const mediumConfidence = (output.match(/Medium confidence: (\d+)/) || [0, 0])[1];
        
        res.json({
            tasksAnalyzed: parseInt(tasksAnalyzed),
            tasksAssigned: parseInt(tasksAssigned),
            highConfidence: parseInt(highConfidence),
            mediumConfidence: parseInt(mediumConfidence),
            output,
            assignments: [] // Could parse assignments from output if needed
        });
    } catch (error) {
        res.json({ error: error.message });
    }
});

// Get worktree statistics
app.get('/api/worktree-stats', async (req, res) => {
    try {
        const { SupabaseClientService } = require('../../../../packages/shared/services/supabase-client');
        const supabase = SupabaseClientService.getInstance().getClient();
        
        // Get all worktrees with task counts
        const { data: worktreeStats, error } = await supabase
            .from('dev_tasks')
            .select('worktree, status')
            .not('worktree', 'is', null);
        
        if (error) throw error;
        
        // Group by worktree and status
        const stats = {};
        worktreeStats.forEach(task => {
            if (!stats[task.worktree]) {
                stats[task.worktree] = {
                    worktree: task.worktree,
                    totalTasks: 0,
                    completedTasks: 0,
                    inProgressTasks: 0,
                    commits: 0
                };
            }
            stats[task.worktree].totalTasks++;
            if (task.status === 'completed') {
                stats[task.worktree].completedTasks++;
            } else if (task.status === 'in_progress') {
                stats[task.worktree].inProgressTasks++;
            }
        });
        
        // Get commit counts per worktree
        const { data: commitStats } = await supabase
            .from('dev_task_commits')
            .select('task_id, dev_tasks!inner(worktree)')
            .not('dev_tasks.worktree', 'is', null);
        
        if (commitStats) {
            commitStats.forEach(commit => {
                const worktree = commit.dev_tasks.worktree;
                if (stats[worktree]) {
                    stats[worktree].commits++;
                }
            });
        }
        
        res.json({
            stats: Object.values(stats)
        });
    } catch (error) {
        res.json({ error: error.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Git History Analysis Server running at http://localhost:${PORT}`);
    console.log(`API endpoints:`);
    console.log(`  GET  /api/analyze-history - Analyze git commit history`);
    console.log(`  POST /api/assign-worktrees - Run worktree assignment`);
    console.log(`  GET  /api/worktree-stats - Get worktree statistics`);
});