#!/usr/bin/env ts-node
/**
 * Shortcut to apply migrations easily
 * Usage: ts-node apply-migration.ts <migration-file.sql>
 */

import { execSync } from 'child_process';
import * as path from 'path';

const args = process.argv.slice(2);
const scriptPath = path.join(__dirname, 'commands/migration/apply.ts');

try {
  execSync(`ts-node "${scriptPath}" ${args.join(' ')}`, {
    stdio: 'inherit',
    cwd: process.cwd()
  });
} catch (error) {
  // Error already handled by the apply script
  process.exit(1);
}