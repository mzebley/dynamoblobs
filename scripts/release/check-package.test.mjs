import assert from 'node:assert/strict';
import test from 'node:test';
import { collectPackageErrors, localTarballSpec } from './check-package.mjs';

const requiredFiles = [
  'LICENSE',
  'README.md',
  'dist/dynamoblobs.cjs',
  'dist/dynamoblobs.d.cts',
  'dist/dynamoblobs.d.mts',
  'dist/dynamoblobs.d.ts',
  'dist/dynamoblobs.esm.js',
  'dist/dynamoblobs.js',
  'dist/dynamoblobs.min.js',
  'package.json',
].map((path) => ({ path, size: path === 'package.json' ? 400 : 100, mode: 0o644 }));

function packageJson(overrides = {}) {
  return {
    name: 'dynamoblobs',
    version: '1.0.0',
    files: ['dist'],
    license: 'MIT',
    repository: { url: 'https://github.com/mzebley/dynamoblobs.git' },
    ...overrides,
  };
}

function packResult(name, files = requiredFiles) {
  return {
    name,
    version: '1.0.0',
    filename: `${name.replace('@', '').replace('/', '-')}-1.0.0.tgz`,
    integrity: `sha512-${name}`,
    shasum: `sha1-${name}`,
    size: 1024,
    entryCount: files.length,
    files,
  };
}

function manifest() {
  return {
    schemaVersion: 1,
    sourceName: 'dynamoblobs',
    sourceVersion: '1.0.0',
    releaseVersion: '1.0.0',
    npm: packResult('dynamoblobs'),
    github: packResult('@mzebley/dynamoblobs'),
  };
}

test('accepts canonical npm and scoped GitHub mirror packages', () => {
  assert.deepEqual(collectPackageErrors(manifest(), packageJson()), []);
});

test('rejects registry drift and non-distributable package contents', () => {
  const candidate = manifest();
  candidate.github.files = [
    ...candidate.github.files,
    { path: 'scripts/private.js', size: 5, mode: 0o644 },
  ];
  const errors = collectPackageErrors(
    candidate,
    packageJson({ publishConfig: { registry: 'https://registry.npmjs.org' } }),
  ).join('\n');
  assert.match(errors, /registry-neutral/);
  assert.match(errors, /non-distributable path/);
  assert.match(errors, /same paths/);
});

test('emits explicit relative tarball paths for npm publish', () => {
  assert.equal(
    localTarballSpec('release-artifacts/pack.json', 'dynamoblobs-1.0.0.tgz'),
    './release-artifacts/dynamoblobs-1.0.0.tgz',
  );
});
