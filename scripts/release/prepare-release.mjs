#!/usr/bin/env node

import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import {
  collectReleaseStateErrors,
  latestVersionFromTags,
  parseReleaseBranch,
  parseStableVersion,
  unreleasedBody,
} from './release-contract.mjs';

export function promoteChangelog(changelog, version, date) {
  const body = unreleasedBody(changelog);
  if (body === undefined) throw new Error('CHANGELOG.md is missing ## [Unreleased].');
  if (!body) throw new Error('CHANGELOG.md [Unreleased] has no entries to promote.');

  const replacement = `## [Unreleased]\n\n## [${version}] - ${date}\n\n${body}\n\n`;
  return changelog.replace(
    /^## \[Unreleased\]\s*\n[\s\S]*?(?=^## \[|(?![\s\S]))/m,
    replacement,
  );
}

function writeJson(path, value) {
  fs.writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function run() {
  const version = process.argv[2];
  if (!version) {
    console.error('Usage: npm run release:prepare -- <stable-version>');
    process.exit(1);
  }

  parseStableVersion(version);
  const branch = execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim();
  const branchVersion = parseReleaseBranch(branch);
  if (branchVersion !== version) {
    throw new Error(
      `Prepare ${version} only from release/v${version}; the current branch is ${branch || '(detached)'}.`,
    );
  }

  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const packageLock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
  const changelog = fs.readFileSync('CHANGELOG.md', 'utf8');
  const tags = execFileSync('git', ['tag', '--list', 'v*'], { encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter(Boolean);
  const latestVersion = latestVersionFromTags(tags);

  const candidateChangelog = promoteChangelog(
    changelog,
    version,
    new Date().toISOString().slice(0, 10),
  );
  const errors = collectReleaseStateErrors({
    latestVersion,
    packageVersion: version,
    lockVersion: version,
    lockRootVersion: version,
    changelog: candidateChangelog,
    branchVersion,
  });
  if (errors.length > 0) throw new Error(errors.join('\n'));

  packageJson.version = version;
  packageLock.version = version;
  packageLock.packages[''].version = version;
  writeJson('package.json', packageJson);
  writeJson('package-lock.json', packageLock);
  fs.writeFileSync('CHANGELOG.md', candidateChangelog);

  console.log(
    `Prepared v${version}. Review package.json, package-lock.json, and CHANGELOG.md, ` +
      `then run npm run gate before opening release: v${version}.`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) run();
