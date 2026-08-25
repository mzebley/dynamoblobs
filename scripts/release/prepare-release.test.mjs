import assert from 'node:assert/strict';
import test from 'node:test';
import { promoteChangelog } from './prepare-release.mjs';

test('promotes Unreleased entries into the first public release', () => {
  const input = [
    '# Changelog',
    '',
    '## [Unreleased]',
    '',
    '### Added',
    '- Public package.',
    '',
    '## [0.10.0] - 2026-08-23',
    '',
    '- Private milestone.',
    '',
  ].join('\n');

  const output = promoteChangelog(input, '1.0.0', '2026-08-25');
  assert.match(output, /## \[Unreleased\]\n\n## \[1\.0\.0\] - 2026-08-25/);
  assert.match(output, /## \[1\.0\.0\][\s\S]*### Added\n- Public package\./);
  assert.match(output, /## \[0\.10\.0\] - 2026-08-23/);
});

test('refuses to cut an empty release', () => {
  assert.throws(
    () => promoteChangelog('# Changelog\n\n## [Unreleased]\n\n## [0.10.0] - 2026-08-23\n', '1.0.0', '2026-08-25'),
    /has no entries/,
  );
});
