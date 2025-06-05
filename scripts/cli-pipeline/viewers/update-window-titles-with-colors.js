#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Color emoji mapping for visual distinction
const COLOR_EMOJIS = {
  '#42b883': '🟢',  // Green
  '#007ACC': '🔵',  // Blue
  '#832561': '🟣',  // Purple
  '#fd9827': '🟠',  // Orange
  '#dd5145': '🔴',  // Red
  '#fbc02d': '🟡',  // Yellow
  '#00BCD4': '🔷',  // Cyan
  '#E91E63': '🩷',  // Pink
  '#4CAF50': '🟩',  // Material Green
  '#9C27B0': '🟪',  // Deep Purple
};

// Worktree to color mapping (from previous setup)
const WORKTREE_COLORS = {
  'dhg-mono': '#42b883',
  'dhg-mono-admin-code': '#007ACC',
  'dhg-mono-dhg-hub': '#832561',
  'dhg-mono-docs': '#fd9827',
  'dhg-mono-gmail-cli-pipeline-research-app': '#dd5145',
  'dhg-mono-improve-audio': '#fbc02d',
  'dhg-mono-improve-cli-pipelines': '#00BCD4',
  'dhg-mono-improve-google': '#E91E63',
  'dhg-mono-improve-suite': '#4CAF50',
  'dhg-mono-integration-bug-fixes-tweaks': '#9C27B0',
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

// Update window title with color emoji
function updateWindowTitle(worktreePath, colorEmoji, worktreeName) {
  const settingsPath = path.join(worktreePath, '.vscode', 'settings.json');
  
  if (!fs.existsSync(settingsPath)) {
    console.log(`   ⚠️  No settings.json found for ${worktreeName}`);
    return false;
  }
  
  try {
    const content = fs.readFileSync(settingsPath, 'utf8');
    const settings = JSON.parse(content);
    
    // Update window title to include color emoji
    settings['window.title'] = `${colorEmoji} \${rootName} - [\${activeEditorShort}] \${dirty}`;
    
    // Write back
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    return true;
  } catch (e) {
    console.error(`   ❌ Error updating ${worktreeName}: ${e.message}`);
    return false;
  }
}

// Main function
function addColorEmojisToTitles() {
  console.log('🎨 Adding color emojis to window titles...\n');
  
  const worktrees = getWorktrees();
  
  worktrees.forEach((wt, index) => {
    const name = path.basename(wt.path);
    const color = WORKTREE_COLORS[name];
    const emoji = COLOR_EMOJIS[color] || '⚪';
    
    console.log(`${emoji} ${name}`);
    console.log(`   Color: ${color || 'default'}`);
    
    if (updateWindowTitle(wt.path, emoji, name)) {
      console.log(`   ✅ Window title updated with color emoji\n`);
    } else {
      console.log(`   ❌ Could not update window title\n`);
    }
  });
  
  console.log('\n✨ Window titles updated!');
  console.log('\nNow each window title will show:');
  console.log('- Color emoji matching the Peacock color');
  console.log('- Worktree name');
  console.log('- Current file and dirty state');
  console.log('\nExample: 🔷 dhg-mono-improve-cli-pipelines - [file.ts] *');
  console.log('\nReload each Cursor window (Cmd+R) to see the changes!');
}

// Run
addColorEmojisToTitles();