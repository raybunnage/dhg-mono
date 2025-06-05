#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Extended color palette - 10 distinct colors
const DISTINCT_COLORS = [
  '#42b883',  // 1. Vue Green
  '#007ACC',  // 2. VS Code Blue
  '#832561',  // 3. Gatsby Purple
  '#fd9827',  // 4. Svelte Orange
  '#dd5145',  // 5. Angular Red
  '#fbc02d',  // 6. JavaScript Yellow
  '#00BCD4',  // 7. Cyan
  '#E91E63',  // 8. Pink
  '#4CAF50',  // 9. Material Green
  '#9C27B0',  // 10. Deep Purple
];

// Assign colors to specific worktrees by name
const WORKTREE_COLORS = {
  'dhg-mono': DISTINCT_COLORS[0],                          // Green
  'dhg-mono-admin-code': DISTINCT_COLORS[1],              // Blue
  'dhg-mono-dhg-hub': DISTINCT_COLORS[2],                 // Purple
  'dhg-mono-docs': DISTINCT_COLORS[3],                     // Orange
  'dhg-mono-gmail-cli-pipeline-research-app': DISTINCT_COLORS[4], // Red
  'dhg-mono-improve-audio': DISTINCT_COLORS[5],            // Yellow
  'dhg-mono-improve-cli-pipelines': DISTINCT_COLORS[6],    // Cyan
  'dhg-mono-improve-google': DISTINCT_COLORS[7],           // Pink
  'dhg-mono-improve-suite': DISTINCT_COLORS[8],            // Material Green
  'dhg-mono-integration-bug-fixes-tweaks': DISTINCT_COLORS[9], // Deep Purple
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

// Create or update Peacock settings
function updatePeacockSettings(worktreePath, color, worktreeName) {
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
  
  // Update Peacock color
  settings['peacock.color'] = color;
  
  // Ensure Peacock affects all UI elements
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
function setupExtendedPeacockColors() {
  console.log('🦚 Setting up extended Peacock colors for all worktrees...\n');
  console.log('Color assignments:');
  console.log('================\n');
  
  const worktrees = getWorktrees();
  
  worktrees.forEach((wt, index) => {
    const name = path.basename(wt.path);
    const branch = wt.branch || 'unknown';
    
    // Use predefined color or fallback to color by index
    const color = WORKTREE_COLORS[name] || DISTINCT_COLORS[index % DISTINCT_COLORS.length];
    
    console.log(`${index + 1}. ${name}`);
    console.log(`   Branch: ${branch}`);
    console.log(`   Color: ${color}`);
    console.log(`   Path: ${wt.path}`);
    
    try {
      updatePeacockSettings(wt.path, color, name);
      console.log(`   ✅ Updated with distinct color\n`);
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}\n`);
    }
  });
  
  console.log('\n✨ Extended color setup complete!');
  console.log('\nTo apply colors:');
  console.log('1. In each Cursor window, press Cmd+R to reload');
  console.log('2. Colors should apply automatically');
  console.log('3. If not, run Command Palette → "Peacock: Refresh Workspace Colors"');
}

// Run the setup
setupExtendedPeacockColors();