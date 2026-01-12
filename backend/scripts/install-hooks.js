#!/usr/bin/env node
/**
 * Install Git Hooks
 *
 * Installs pre-commit hook to run pre-deploy checks before each commit.
 *
 * Usage: node scripts/install-hooks.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Find git hooks directory (could be at repo root)
const backendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(backendRoot, '..');
const hooksDir = path.join(repoRoot, '.git', 'hooks');

if (!fs.existsSync(hooksDir)) {
  console.error('❌ Git hooks directory not found. Are you in a git repository?');
  process.exit(1);
}

const preCommitPath = path.join(hooksDir, 'pre-commit');

const hookContent = `#!/bin/sh
# Pre-commit hook: Run backend pre-deploy checks
# Installed by: cd backend && node scripts/install-hooks.js

# Only run if backend files changed
if git diff --cached --name-only | grep -q "^backend/"; then
  echo "🔍 Backend files changed, running pre-deploy checks..."
  cd backend
  node scripts/pre-deploy-check.js
  if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Pre-commit check failed. Fix the issues above before committing."
    echo "   To skip this check (not recommended): git commit --no-verify"
    exit 1
  fi
  cd ..
fi

exit 0
`;

// Check if hook already exists
if (fs.existsSync(preCommitPath)) {
  const existing = fs.readFileSync(preCommitPath, 'utf-8');
  if (existing.includes('pre-deploy-check.js')) {
    console.log('✅ Pre-commit hook already installed');
    process.exit(0);
  }

  // Backup existing hook
  const backupPath = `${preCommitPath}.backup`;
  fs.copyFileSync(preCommitPath, backupPath);
  console.log(`📦 Backed up existing hook to: ${backupPath}`);

  // Append to existing hook
  const combined = existing.replace(/exit 0\s*$/, '') + '\n' + hookContent;
  fs.writeFileSync(preCommitPath, combined, { mode: 0o755 });
  console.log('✅ Added pre-deploy check to existing pre-commit hook');
} else {
  // Create new hook
  fs.writeFileSync(preCommitPath, hookContent, { mode: 0o755 });
  console.log('✅ Pre-commit hook installed');
}

console.log(`   Location: ${preCommitPath}`);
console.log('');
console.log('The hook will automatically run when you commit backend changes.');
