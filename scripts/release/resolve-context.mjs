#!/usr/bin/env node

import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { parseCandidateVersion, parseReleaseBranch, parseReleaseTitle } from './release-contract.mjs';

export function selectReleasePullRequest(pullRequests, version) {
  return pullRequests.filter((pullRequest) => {
    return (
      pullRequest.merged_at &&
      pullRequest.base?.ref === 'main' &&
      parseReleaseBranch(pullRequest.head?.ref ?? '') === version &&
      parseReleaseTitle(pullRequest.title ?? '') === version
    );
  });
}

function emit(values) {
  const outputPath = process.env.GITHUB_OUTPUT;
  const lines = Object.entries(values).map(([key, value]) => `${key}=${value}`);
  if (outputPath) fs.appendFileSync(outputPath, `${lines.join('\n')}\n`);
  else console.log(lines.join('\n'));
}

function runCandidate(packageJson) {
  const candidate = process.env.RELEASE_CANDIDATE_VERSION ?? '';
  const { baseVersion } = parseCandidateVersion(candidate);
  const branch = process.env.GITHUB_REF_NAME ?? '';
  if (parseReleaseBranch(branch) !== baseVersion || packageJson.version !== baseVersion) {
    throw new Error(
      `Run ${candidate} from release/v${baseVersion} with package.json prepared at ${baseVersion}.`,
    );
  }

  emit({
    should_release: 'true',
    publish: process.env.RELEASE_PUBLISH === 'true' ? 'true' : 'false',
    version: candidate,
    channel: 'next',
    prerelease: 'true',
    head_branch: branch,
    head_sha: process.env.GITHUB_SHA ?? '',
    pr_title: `release: v${baseVersion}`,
  });
}

function runProduction(packageJson) {
  const repository = process.env.GITHUB_REPOSITORY ?? '';
  const sha = process.env.GITHUB_SHA ?? '';
  if (!repository || !sha) throw new Error('GITHUB_REPOSITORY and GITHUB_SHA are required.');

  const response = execFileSync('gh', ['api', `repos/${repository}/commits/${sha}/pulls`], {
    encoding: 'utf8',
  });
  const matches = selectReleasePullRequest(JSON.parse(response), packageJson.version);
  if (matches.length === 0) {
    emit({ should_release: 'false', publish: 'false' });
    return;
  }
  if (matches.length !== 1) {
    throw new Error(
      `Expected one merged release/v${packageJson.version} pull request for ${sha}; found ${matches.length}.`,
    );
  }

  const pullRequest = matches[0];
  emit({
    should_release: 'true',
    publish: 'true',
    version: packageJson.version,
    channel: 'latest',
    prerelease: 'false',
    head_branch: pullRequest.head.ref,
    head_sha: pullRequest.head.sha,
    pr_title: pullRequest.title,
    pr_number: pullRequest.number,
  });
}

function run() {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  if (process.env.GITHUB_EVENT_NAME === 'workflow_dispatch') runCandidate(packageJson);
  else if (process.env.GITHUB_EVENT_NAME === 'push') runProduction(packageJson);
  else throw new Error(`Unsupported release event ${process.env.GITHUB_EVENT_NAME ?? '(missing)'}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) run();
