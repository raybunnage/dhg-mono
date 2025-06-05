#!/usr/bin/env node

const { execSync } = require('child_process');

// List of all server ports
const SERVER_PORTS = [3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009];

console.log('🛑 Killing all development servers...\n');

// Function to kill process on a specific port
function killPortProcess(port) {
  try {
    if (process.platform === 'darwin' || process.platform === 'linux') {
      const pid = execSync(`lsof -ti:${port} 2>/dev/null || true`).toString().trim();
      if (pid) {
        execSync(`kill -9 ${pid} 2>/dev/null || true`);
        console.log(`✅ Killed process on port ${port} (PID: ${pid})`);
      } else {
        console.log(`ℹ️  Port ${port} is already free`);
      }
    } else if (process.platform === 'win32') {
      // Windows command to find and kill process
      execSync(`FOR /F "tokens=5" %a in ('netstat -aon ^| findstr :${port}') do taskkill /F /PID %a 2>nul || true`);
    }
  } catch (e) {
    console.log(`ℹ️  Port ${port} is already free`);
  }
}

// Kill all server processes
SERVER_PORTS.forEach(port => {
  killPortProcess(port);
});

console.log('\n✅ All server ports have been cleaned up');
console.log('You can now run "pnpm servers" to start fresh.\n');