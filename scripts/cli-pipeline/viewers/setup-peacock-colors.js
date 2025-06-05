#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Color scheme for different branch types
const COLOR_SCHEME = {
  'main': '#42b883',          // Vue Green
  'master': '#42b883',        // Vue Green
  'development': '#832561',    // Gatsby Purple
  'develop': '#832561',       // Gatsby Purple
  'feature': '#fd9827',       // Svelte Orange
  'bugfix': '#dd5145',        // Angular Red
  'hotfix': '#dd5145',        // Angular Red
  'fix': '#dd5145',           // Angular Red
  'experimental': '#fbc02d',   // JavaScript Yellow
  'default': '#007ACC'        // Default Blue
};

// Get all worktrees
function getWorktrees() {
  try {
    const output = execSync('git worktree list --porcelain', { encoding: 'utf8' });
    const worktrees = [];
    let current = {};
    
    output.split('\n').forEach(line => {
      if (line.startsWith('worktree ')) {
        if (current.path) worktrees.push(current);
        current = { path: line.substring(9) };
      } else if (line.startsWith('branch ')) {
        current.branch = line.substring(7);
      }
    });
    
    if (current.path) worktrees.push(current);
    return worktrees;
  } catch (error) {
    console.error('Error getting worktrees:', error);
    return [];
  }
}

// Determine color based on branch name
function getColorForBranch(branch) {
  if (!branch) return COLOR_SCHEME.default;
  
  // Check exact matches first
  if (COLOR_SCHEME[branch]) return COLOR_SCHEME[branch];
  
  // Check if branch contains any key
  for (const [key, color] of Object.entries(COLOR_SCHEME)) {
    if (branch.toLowerCase().includes(key)) {
      return color;
    }
  }
  
  return COLOR_SCHEME.default;
}

// Create Peacock settings for a worktree
function createPeacockSettings(worktreePath, color) {
  const vscodeDir = path.join(worktreePath, '.vscode');
  const settingsPath = path.join(vscodeDir, 'settings.json');
  
  // Create .vscode directory if it doesn't exist
  if (!fs.existsSync(vscodeDir)) {
    fs.mkdirSync(vscodeDir, { recursive: true });
  }
  
  // Read existing settings or create new
  let settings = {};
  if (fs.existsSync(settingsPath)) {
    try {
      const content = fs.readFileSync(settingsPath, 'utf8');
      settings = JSON.parse(content);
    } catch (e) {
      console.warn(`Could not parse existing settings for ${worktreePath}`);
    }
  }
  
  // Add window title if not present
  if (!settings['window.title']) {
    settings['window.title'] = '🌳 ${rootName} - [${activeEditorShort}] ${dirty}';
  }
  
  // Add Peacock settings
  settings['peacock.color'] = color;
  settings['peacock.affectActivityBar'] = true;
  settings['peacock.affectStatusBar'] = true;
  settings['peacock.affectTitleBar'] = true;
  settings['peacock.affectAccentBorders'] = true;
  settings['peacock.affectTabActiveBorder'] = true;
  settings['peacock.keepForegroundColor'] = false;
  settings['peacock.surpriseMeOnStartup'] = false;
  
  // Write settings
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  
  return true;
}

// Main function
function setupPeacockColors() {
  console.log('🦚 Setting up Peacock colors for all worktrees...\n');
  
  const worktrees = getWorktrees();
  
  if (worktrees.length === 0) {
    console.log('No worktrees found!');
    return;
  }
  
  console.log(`Found ${worktrees.length} worktrees:\n`);
  
  worktrees.forEach(wt => {
    const name = path.basename(wt.path);
    const branch = wt.branch || 'unknown';
    const color = getColorForBranch(branch);
    
    console.log(`📁 ${name} (${branch})`);
    console.log(`   Path: ${wt.path}`);
    console.log(`   Color: ${color}`);
    
    try {
      createPeacockSettings(wt.path, color);
      console.log(`   ✅ Peacock settings created\n`);
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}\n`);
    }
  });
  
  console.log('\n✨ Peacock setup complete!');
  console.log('\nNext steps:');
  console.log('1. Open each worktree in Cursor');
  console.log('2. Reload the window (Cmd+R) to apply colors');
  console.log('3. Or run "Peacock: Change to a Favorite Color" to customize');
  console.log('\nVisit http://localhost:3010 to see all worktrees with their colors!');
}

// Run the setup
setupPeacockColors();