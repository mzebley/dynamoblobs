#!/usr/bin/env node

import { execFileSync } from 'node:child_process';

const GENERATED_PATHS = [
  'dist',
  'src/lib/styles/zbk-dynamoblobs.min.css',
  'src/lib/styles/zbk-dark.css',
  'src/lib/styles/zebkit-a11y-input.json',
  'zebkit/zebkit.runtime.js',
];

const status = execFileSync(
  'git',
  ['status', '--porcelain=v1', '--untracked-files=all', '--', ...GENERATED_PATHS],
  { encoding: 'utf8' },
).trim();

if (status) {
  console.error('::error::Generated package or documentation artifacts are stale or uncommitted:');
  console.error(status);
  console.error('Run npm run build:docs and commit the resulting generated artifacts.');
  process.exit(1);
}

console.log('Generated contract: package and documentation build outputs match the committed source.');
