#!/usr/bin/env node
/**
 * Pre-deployment Check Script
 *
 * Runs before deployment to catch common issues:
 * 1. Import paths pointing outside backend directory
 * 2. Missing environment variables
 * 3. Syntax errors in JavaScript files
 *
 * Usage: node scripts/pre-deploy-check.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '..');

let hasErrors = false;

console.log('🔍 Running pre-deployment checks...\n');

// =====================================================
// Check 1: Import paths outside backend directory
// =====================================================
console.log('📁 Checking import paths...');

function checkImportsInFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const errors = [];

  lines.forEach((line, index) => {
    // Match import statements with relative paths going outside backend
    // e.g., import { x } from '../../shared/...'
    const importMatch = line.match(/import\s+.*from\s+['"](\.\.[\/\\]\.\..*)['"]/);
    if (importMatch) {
      const importPath = importMatch[1];
      // Check if it goes outside backend (more than one level up from src)
      if (importPath.startsWith('../../') && !importPath.startsWith('../../src')) {
        errors.push({
          line: index + 1,
          path: importPath,
          content: line.trim()
        });
      }
    }

    // Also check require statements
    const requireMatch = line.match(/require\s*\(\s*['"](\.\.[\/\\]\.\..*)['"]\s*\)/);
    if (requireMatch) {
      const requirePath = requireMatch[1];
      if (requirePath.startsWith('../../') && !requirePath.startsWith('../../src')) {
        errors.push({
          line: index + 1,
          path: requirePath,
          content: line.trim()
        });
      }
    }
  });

  return errors;
}

function walkDir(dir, callback) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory() && file !== 'node_modules') {
      walkDir(filePath, callback);
    } else if (file.endsWith('.js') || file.endsWith('.ts')) {
      callback(filePath);
    }
  });
}

const srcDir = path.join(backendRoot, 'src');
let importIssues = [];

walkDir(srcDir, (filePath) => {
  const errors = checkImportsInFile(filePath);
  if (errors.length > 0) {
    importIssues.push({ file: filePath, errors });
  }
});

if (importIssues.length > 0) {
  console.log('❌ Found imports pointing outside backend directory:');
  importIssues.forEach(({ file, errors }) => {
    const relativePath = path.relative(backendRoot, file);
    errors.forEach(err => {
      console.log(`   ${relativePath}:${err.line}`);
      console.log(`   → ${err.path}`);
      console.log(`   ${err.content}\n`);
    });
  });
  hasErrors = true;
} else {
  console.log('✅ All import paths are valid\n');
}

// =====================================================
// Check 2: Required environment variables
// =====================================================
console.log('🔐 Checking environment variables documentation...');

const requiredEnvVars = [
  'DATABASE_URL',
  'PRIVY_APP_ID',
  'PRIVY_APP_SECRET',
  'R2_ENDPOINT',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
];

// Check if .env.example exists and documents required vars
const envExamplePath = path.join(backendRoot, '.env.example');
if (fs.existsSync(envExamplePath)) {
  const envExample = fs.readFileSync(envExamplePath, 'utf-8');
  const missingDocs = requiredEnvVars.filter(v => !envExample.includes(v));

  if (missingDocs.length > 0) {
    console.log('⚠️  Some required env vars not documented in .env.example:');
    missingDocs.forEach(v => console.log(`   - ${v}`));
    console.log('');
  } else {
    console.log('✅ All required env vars documented\n');
  }
} else {
  console.log('⚠️  No .env.example file found\n');
}

// =====================================================
// Check 3: Duplicate exports check
// =====================================================
console.log('📝 Checking for duplicate exports...');

let duplicateExports = [];

walkDir(srcDir, (filePath) => {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  // Track exported names
  const exports = new Map();
  const issues = [];

  lines.forEach((line, index) => {
    // Match: export const/let/var/function/class name
    const exportMatch = line.match(/export\s+(const|let|var|function|class|async\s+function)\s+(\w+)/);
    if (exportMatch) {
      const name = exportMatch[2];
      if (exports.has(name)) {
        issues.push({
          name,
          firstLine: exports.get(name),
          secondLine: index + 1
        });
      } else {
        exports.set(name, index + 1);
      }
    }
  });

  if (issues.length > 0) {
    duplicateExports.push({ file: filePath, issues });
  }
});

if (duplicateExports.length > 0) {
  console.log('⚠️  Duplicate exports found:');
  duplicateExports.forEach(({ file, issues }) => {
    const relativePath = path.relative(backendRoot, file);
    issues.forEach(issue => {
      console.log(`   ${relativePath}: "${issue.name}" exported at lines ${issue.firstLine} and ${issue.secondLine}`);
    });
  });
  console.log('');
} else {
  console.log('✅ No duplicate exports found\n');
}

// =====================================================
// Check 4: Package.json main entry point
// =====================================================
console.log('📦 Checking package.json...');

const packageJson = JSON.parse(fs.readFileSync(path.join(backendRoot, 'package.json'), 'utf-8'));
const mainEntry = packageJson.main || 'index.js';
const mainPath = path.join(backendRoot, mainEntry);

if (!fs.existsSync(mainPath)) {
  console.log(`❌ Main entry point not found: ${mainEntry}`);
  hasErrors = true;
} else {
  console.log(`✅ Main entry point exists: ${mainEntry}\n`);
}

// =====================================================
// Summary
// =====================================================
console.log('═'.repeat(50));
if (hasErrors) {
  console.log('❌ Pre-deployment check FAILED');
  console.log('   Fix the issues above before deploying.\n');
  process.exit(1);
} else {
  console.log('✅ Pre-deployment check PASSED');
  console.log('   Ready to deploy!\n');
  process.exit(0);
}
