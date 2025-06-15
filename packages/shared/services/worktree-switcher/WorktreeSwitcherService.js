"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorktreeSwitcherService = void 0;
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
class WorktreeSwitcherService {
    static instance;
    constructor() { }
    static getInstance() {
        if (!WorktreeSwitcherService.instance) {
            WorktreeSwitcherService.instance = new WorktreeSwitcherService();
        }
        return WorktreeSwitcherService.instance;
    }
    /**
     * Get all git worktrees with enhanced information
     */
    getWorktrees() {
        try {
            const output = (0, child_process_1.execSync)('git worktree list --porcelain', { encoding: 'utf8' });
            const worktrees = [];
            let current = {};
            output.split('\n').forEach(line => {
                if (line.startsWith('worktree ')) {
                    if (current.path)
                        worktrees.push(current);
                    current = { path: line.substring(9) };
                }
                else if (line.startsWith('HEAD ')) {
                    current.head = line.substring(5);
                }
                else if (line.startsWith('branch ')) {
                    current.branch = line.substring(7);
                }
                else if (line === 'detached') {
                    current.detached = true;
                }
            });
            if (current.path)
                worktrees.push(current);
            // Get additional info for each worktree
            return worktrees.map(wt => {
                const name = path.basename(wt.path);
                const isActive = wt.path === process.cwd();
                // Check if Cursor/VS Code is running for this worktree
                let cursorPid = null;
                try {
                    if (os.platform() === 'darwin') {
                        // macOS: Check for Cursor processes with this path
                        const psOutput = (0, child_process_1.execSync)(`ps aux | grep -i cursor | grep "${wt.path}" | grep -v grep`, { encoding: 'utf8' });
                        if (psOutput) {
                            cursorPid = psOutput.trim().split(/\s+/)[1];
                        }
                    }
                }
                catch (e) {
                    // No process found
                }
                // Check for Peacock configuration
                let peacockColor = null;
                let hasPeacock = false;
                try {
                    const settingsPath = path.join(wt.path, '.vscode', 'settings.json');
                    if (fs.existsSync(settingsPath)) {
                        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
                        if (settings['peacock.color']) {
                            peacockColor = settings['peacock.color'];
                            hasPeacock = true;
                        }
                    }
                }
                catch (e) {
                    // No settings or error reading
                }
                return {
                    ...wt,
                    name,
                    isActive,
                    hasCursor: !!cursorPid,
                    cursorPid,
                    hasPeacock,
                    peacockColor
                };
            });
        }
        catch (error) {
            console.error('Error getting worktrees:', error);
            return [];
        }
    }
    /**
     * Open or focus a worktree in Cursor
     */
    openInCursor(worktreePath) {
        return new Promise((resolve, reject) => {
            const command = os.platform() === 'darwin'
                ? `open -a "Cursor" "${worktreePath}"`
                : os.platform() === 'win32'
                    ? `code "${worktreePath}"`
                    : `cursor "${worktreePath}"`;
            (0, child_process_1.exec)(command, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve({ success: true, message: `Opened ${worktreePath} in Cursor` });
                }
            });
        });
    }
    /**
     * Create a new worktree
     */
    async createWorktree(branchName, baseBranch = 'main') {
        try {
            // Create worktree path
            const worktreePath = path.join(path.dirname(process.cwd()), branchName);
            // Create the worktree
            (0, child_process_1.execSync)(`git worktree add -b ${branchName} ${worktreePath} ${baseBranch}`, { encoding: 'utf8' });
            return {
                success: true,
                path: worktreePath
            };
        }
        catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
    /**
     * Remove a worktree
     */
    async removeWorktree(worktreePath) {
        try {
            // Remove the worktree
            (0, child_process_1.execSync)(`git worktree remove ${worktreePath}`, { encoding: 'utf8' });
            return {
                success: true
            };
        }
        catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
    /**
     * Get default colors for branches
     */
    getDefaultColor(branch) {
        if (!branch)
            return '#fbc02d';
        if (branch.includes('main'))
            return '#42b883';
        if (branch.includes('development'))
            return '#007ACC';
        if (branch.includes('improve-cli-pipelines'))
            return '#832561';
        if (branch.includes('feature'))
            return '#fd9827';
        if (branch.includes('fix') || branch.includes('bug'))
            return '#dd5145';
        return '#fbc02d';
    }
    /**
     * Generate HTML for worktree switcher UI
     */
    generateHTML(worktrees) {
        const worktreeButtons = worktrees.map((wt, index) => {
            const color = wt.peacockColor || this.getDefaultColor(wt.branch);
            const icon = wt.isActive ? '📍' : wt.hasCursor ? '🖥️' : '📁';
            const hotkey = index < 9 ? `(${index + 1})` : '';
            return `
        <div class="worktree-card" data-path="${wt.path}" style="border-color: ${color};">
          <div class="worktree-header" style="background-color: ${color};">
            <span class="worktree-icon">${icon}</span>
            <span class="worktree-name">${wt.name}</span>
            <span class="hotkey">${hotkey}</span>
          </div>
          <div class="worktree-info">
            <div class="branch-name">${wt.branch || 'detached'}</div>
            <div class="worktree-path">${wt.path}</div>
            ${wt.isActive ? '<div class="status active">Current</div>' : ''}
            ${wt.hasCursor ? '<div class="status cursor-open">Cursor Open</div>' : ''}
            ${wt.hasPeacock ? '<div class="status peacock">🦚 Peacock</div>' : '<div class="status no-peacock">⚠️ No Peacock</div>'}
          </div>
        </div>
      `;
        }).join('');
        return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Worktree Switcher</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #1e1e1e;
            color: #d4d4d4;
            padding: 20px;
            min-height: 100vh;
          }
          
          .container {
            max-width: 1200px;
            margin: 0 auto;
          }
          
          h1 {
            text-align: center;
            margin-bottom: 30px;
            color: #fff;
            font-weight: 300;
            font-size: 2.5em;
          }
          
          .worktrees-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
          }
          
          .worktree-card {
            background: #252526;
            border: 2px solid;
            border-radius: 8px;
            overflow: hidden;
            cursor: pointer;
            transition: all 0.2s;
          }
          
          .worktree-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 20px rgba(0,0,0,0.5);
          }
          
          .worktree-header {
            padding: 15px;
            color: white;
            display: flex;
            align-items: center;
            gap: 10px;
            font-weight: 500;
          }
          
          .worktree-icon {
            font-size: 1.2em;
          }
          
          .worktree-name {
            flex: 1;
            font-size: 1.1em;
          }
          
          .hotkey {
            opacity: 0.7;
            font-size: 0.9em;
          }
          
          .worktree-info {
            padding: 15px;
          }
          
          .branch-name {
            font-weight: 500;
            margin-bottom: 5px;
            color: #569cd6;
          }
          
          .worktree-path {
            font-size: 0.85em;
            color: #858585;
            margin-bottom: 10px;
            word-break: break-all;
          }
          
          .status {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 0.8em;
            margin-right: 5px;
            margin-top: 5px;
          }
          
          .status.active {
            background: #0e639c;
            color: white;
          }
          
          .status.cursor-open {
            background: #16825d;
            color: white;
          }
          
          .status.peacock {
            background: #895503;
            color: white;
          }
          
          .status.no-peacock {
            background: #5a1d1d;
            color: #ff8888;
          }
          
          .help {
            text-align: center;
            margin-top: 40px;
            padding: 20px;
            background: #252526;
            border-radius: 8px;
          }
          
          .help h2 {
            margin-bottom: 10px;
            color: #fff;
          }
          
          .help p {
            color: #858585;
            line-height: 1.6;
          }
          
          .loading {
            text-align: center;
            padding: 40px;
            font-size: 1.2em;
          }
          
          .error {
            background: #5a1d1d;
            color: #ff8888;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🌳 Git Worktree Switcher</h1>
          <div class="worktrees-grid">
            ${worktreeButtons}
          </div>
          <div class="help">
            <h2>Keyboard Shortcuts</h2>
            <p>
              Press <strong>1-9</strong> to quickly open a worktree in Cursor<br>
              <strong>Click</strong> any worktree card to open it in Cursor<br>
              <strong>R</strong> to refresh the list
            </p>
          </div>
        </div>
        
        <script>
          // Handle clicks
          document.querySelectorAll('.worktree-card').forEach(card => {
            card.addEventListener('click', () => {
              const path = card.dataset.path;
              openWorktree(path);
            });
          });
          
          // Handle keyboard shortcuts
          document.addEventListener('keydown', (e) => {
            if (e.key >= '1' && e.key <= '9') {
              const index = parseInt(e.key) - 1;
              const cards = document.querySelectorAll('.worktree-card');
              if (cards[index]) {
                const path = cards[index].dataset.path;
                openWorktree(path);
              }
            } else if (e.key.toLowerCase() === 'r') {
              location.reload();
            }
          });
          
          function openWorktree(path) {
            fetch('/open', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ path })
            })
            .then(res => res.json())
            .then(data => {
              if (data.success) {
                // Show visual feedback
                const card = document.querySelector(\`[data-path="\${path}"]\`);
                if (card) {
                  card.style.opacity = '0.5';
                  setTimeout(() => {
                    card.style.opacity = '1';
                  }, 500);
                }
              } else {
                alert('Failed to open worktree: ' + (data.error || 'Unknown error'));
              }
            })
            .catch(err => {
              console.error('Error:', err);
              alert('Failed to open worktree');
            });
          }
        </script>
      </body>
      </html>
    `;
    }
}
exports.WorktreeSwitcherService = WorktreeSwitcherService;
//# sourceMappingURL=WorktreeSwitcherService.js.map