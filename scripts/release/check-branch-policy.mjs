#!/usr/bin/env node

import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import {
  collectBranchPolicyErrors,
  collectReleaseStateErrors,
  latestVersionFromTags,
  parseReleaseBranch,
  parseReleaseTitle,
} from './release-contract.mjs';

const eventName = process.env.GITHUB_EVENT_NAME;
if (eventName !== 'pull_request') {
  console.log(`Branch policy: ${eventName ?? 'local'} event does not need PR routing checks.`);
  process.exit(0);
}

const baseBranch = process.env.RELEASE_BASE_BRANCH ?? '';
const headBranch = process.env.RELEASE_HEAD_BRANCH ?? '';
const title = process.env.RELEASE_PR_TITLE ?? '';
const baseSha = process.env.RELEASE_BASE_SHA ?? '';
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
let basePackage;

try {
  basePackage = JSON.parse(
    execFileSync('git', ['show', `${baseSha}:package.json`], { encoding: 'utf8' }),
  );
} catch {
  console.error(`::error::Could not read package.json from PR base ${baseSha || '(missing)'}.`);
  process.exit(1);
}

const versionChanged = packageJson.version !== basePackage.version;
const errors = collectBranchPolicyErrors({ baseBranch, headBranch, title, versionChanged });
const branchVersion = parseReleaseBranch(headBranch);

if (branchVersion) {
  const packageLock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
  const changelog = fs.readFileSync('CHANGELOG.md', 'utf8');
  const tags = execFileSync('git', ['tag', '--list', 'v*'], { encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter(Boolean);

  errors.push(
    ...collectReleaseStateErrors({
      latestVersion: latestVersionFromTags(tags),
      packageVersion: packageJson.version,
      lockVersion: packageLock.version,
      lockRootVersion: packageLock.packages?.['']?.version,
      changelog,
      branchVersion,
      titleVersion: parseReleaseTitle(title),
    }),
  );
}

if (errors.length > 0) {
  for (const error of errors) console.error(`::error::${error}`);
  process.exit(1);
}

console.log(
  branchVersion
    ? `Branch policy: release/v${branchVersion} is a valid release candidate for main.`
    : `Branch policy: ${headBranch} is a valid feature, fix, or documentation PR for main.`,
);
