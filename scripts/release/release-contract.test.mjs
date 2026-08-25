import assert from 'node:assert/strict';
import test from 'node:test';
import {
  bumpVersion,
  collectBranchPolicyErrors,
  collectReleaseStateErrors,
  isPrePublicMilestoneChange,
  parseCandidateVersion,
  parseReleaseBranch,
  parseReleaseTitle,
  parseStableVersion,
  unreleasedBody,
} from './release-contract.mjs';

test('parses stable and release-candidate versions strictly', () => {
  assert.deepEqual(parseStableVersion('1.0.0'), { major: 1, minor: 0, patch: 0 });
  assert.deepEqual(parseCandidateVersion('1.0.0-rc.2'), {
    baseVersion: '1.0.0',
    candidateNumber: 2,
  });
  assert.throws(() => parseStableVersion('v1.0.0'), /not a stable SemVer/);
  assert.throws(() => parseCandidateVersion('1.0.0-rc.0'), /not a release-candidate/);
});

test('calculates one explicit stable increment', () => {
  assert.equal(bumpVersion('1.0.0', 'patch'), '1.0.1');
  assert.equal(bumpVersion('1.0.0', 'minor'), '1.1.0');
  assert.equal(bumpVersion('1.0.0', 'major'), '2.0.0');
});

test('keeps release branches and titles exact', () => {
  assert.equal(parseReleaseBranch('release/v1.0.0'), '1.0.0');
  assert.equal(parseReleaseTitle('release: v1.0.0'), '1.0.0');
  assert.equal(parseReleaseBranch('feat/release-v1'), undefined);
  assert.equal(parseReleaseTitle('release(major): v1.0.0'), undefined);
});

test('accepts 1.0.0 as the first public release without a baseline tag', () => {
  const errors = collectReleaseStateErrors({
    latestVersion: undefined,
    packageVersion: '1.0.0',
    lockVersion: '1.0.0',
    lockRootVersion: '1.0.0',
    changelog: '# Changelog\n\n## [Unreleased]\n\n## [1.0.0] - 2026-08-25\n\n- First public release.\n',
    branchVersion: '1.0.0',
    titleVersion: '1.0.0',
  });
  assert.deepEqual(errors, []);
});

test('rejects a pre-1.0 first public release and stale Unreleased entries', () => {
  const errors = collectReleaseStateErrors({
    latestVersion: undefined,
    packageVersion: '0.10.0',
    lockVersion: '0.10.0',
    lockRootVersion: '0.10.0',
    changelog: '# Changelog\n\n## [Unreleased]\n\n- Still here.\n\n## [0.10.0] - 2026-08-25\n',
  }).join('\n');
  assert.match(errors, /first public release must be 1.0.0/);
  assert.match(errors, /\[Unreleased\] must be empty/);
});

test('routes version changes through a release branch', () => {
  assert.deepEqual(
    collectBranchPolicyErrors({
      baseBranch: 'main',
      headBranch: 'release/v1.0.0',
      title: 'release: v1.0.0',
      versionChanged: true,
    }),
    [],
  );
  assert.match(
    collectBranchPolicyErrors({
      baseBranch: 'main',
      headBranch: 'feat/blob',
      title: 'Change blob',
      versionChanged: true,
    }).join('\n'),
    /version changes are allowed only/,
  );
});

test('allows only forward 0.x milestones before the first public tag', () => {
  assert.equal(
    isPrePublicMilestoneChange({
      latestVersion: undefined,
      previousVersion: '0.9.1',
      nextVersion: '0.10.0',
    }),
    true,
  );
  assert.equal(
    isPrePublicMilestoneChange({
      latestVersion: undefined,
      previousVersion: '0.10.0',
      nextVersion: '1.0.0',
    }),
    false,
  );
  assert.equal(
    isPrePublicMilestoneChange({
      latestVersion: '1.0.0',
      previousVersion: '1.0.0',
      nextVersion: '1.1.0',
    }),
    false,
  );
});

test('reads only the content under Unreleased', () => {
  assert.equal(
    unreleasedBody('# Changelog\n\n## [Unreleased]\n\n### Fixed\n- One.\n\n## [0.9.0] - 2026-01-01\n'),
    '### Fixed\n- One.',
  );
  assert.equal(
    unreleasedBody('# Changelog\n\n## [Unreleased]\n\n## [1.0.0] - 2026-01-01\n'),
    '',
  );
});
