#!/usr/bin/env node

import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import {
  collectReleaseStateErrors,
  latestVersionFromTags,
  parseReleaseBranch,
  parseReleaseTitle,
} from './release-contract.mjs';

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const packageLock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
const changelog = fs.readFileSync('CHANGELOG.md', 'utf8');
const tags = execFileSync('git', ['tag', '--list', 'v*'], { encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter(Boolean);
const releaseTag = `v${packageJson.version}`;
const latestVersion = latestVersionFromTags(tags.filter((tag) => tag !== releaseTag));
const headBranch = process.env.RELEASE_HEAD_BRANCH ?? '';
const prTitle = process.env.RELEASE_PR_TITLE ?? '';
const releaseHeadSha = process.env.RELEASE_HEAD_SHA ?? '';
const errors = collectReleaseStateErrors({
  latestVersion,
  packageVersion: packageJson.version,
  lockVersion: packageLock.version,
  lockRootVersion: packageLock.packages?.['']?.version,
  changelog,
  branchVersion: parseReleaseBranch(headBranch),
  titleVersion: parseReleaseTitle(prTitle),
});

if (releaseHeadSha) {
  try {
    const productionTree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], {
      encoding: 'utf8',
    }).trim();
    const candidateTree = execFileSync('git', ['rev-parse', `${releaseHeadSha}^{tree}`], {
      encoding: 'utf8',
    }).trim();
    if (candidateTree !== productionTree) {
      errors.push(
        `Production tree ${productionTree} does not match release candidate tree ${candidateTree}.`,
      );
    }
  } catch {
    errors.push(`Could not verify release candidate commit ${releaseHeadSha}.`);
  }
}

if (tags.includes(releaseTag)) {
  const taggedCommit = execFileSync('git', ['rev-list', '-n', '1', releaseTag], {
    encoding: 'utf8',
  }).trim();
  const headCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (taggedCommit !== headCommit) {
    errors.push(`${releaseTag} already points to ${taggedCommit}, not production HEAD ${headCommit}.`);
  }
}

if (errors.length > 0) {
  for (const error of errors) console.error(`::error::${error}`);
  process.exit(1);
}

console.log(
  `Release contract: ${releaseTag} is synchronized, documented, and matches ${headBranch}.`,
);
