#!/usr/bin/env node

import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import {
  collectReleaseStateErrors,
  latestVersionFromTags,
  parseCandidateVersion,
  parseReleaseBranch,
} from './release-contract.mjs';

const candidate = process.argv[2];
if (!candidate) {
  console.error('Usage: node scripts/release/check-candidate.mjs <x.y.z-rc.n>');
  process.exit(1);
}

const { baseVersion } = parseCandidateVersion(candidate);
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const packageLock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
const changelog = fs.readFileSync('CHANGELOG.md', 'utf8');
const branch = process.env.RELEASE_HEAD_BRANCH ?? process.env.GITHUB_REF_NAME ?? '';
const branchVersion = parseReleaseBranch(branch);
const tags = execFileSync('git', ['tag', '--list', 'v*'], { encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter(Boolean);
const errors = collectReleaseStateErrors({
  latestVersion: latestVersionFromTags(tags),
  packageVersion: packageJson.version,
  lockVersion: packageLock.version,
  lockRootVersion: packageLock.packages?.['']?.version,
  changelog,
  branchVersion,
});

if (baseVersion !== packageJson.version) {
  errors.push(
    `Candidate ${candidate} targets ${baseVersion}, but package.json is prepared for ${packageJson.version}.`,
  );
}
if (!branchVersion) {
  errors.push(`Release candidates must run from release/v${baseVersion}, not ${branch || '(detached)'}.`);
}

if (errors.length > 0) {
  for (const error of errors) console.error(`::error::${error}`);
  process.exit(1);
}

console.log(`Candidate contract: ${candidate} is prepared from release/v${baseVersion}.`);
