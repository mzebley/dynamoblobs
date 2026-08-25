#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const REQUIRED_FILES = [
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
];
const FORBIDDEN_PREFIXES = ['.github/', 'build/', 'scripts/', 'src/', 'test/', 'zebkit/'];

function filesByPath(packResult) {
  return new Map((packResult.files ?? []).map((file) => [file.path, file]));
}

function collectOnePackageErrors(packResult, expectedName, expectedVersion) {
  const errors = [];
  if (packResult.name !== expectedName) {
    errors.push(`Packed name ${packResult.name} does not match ${expectedName}.`);
  }
  if (packResult.version !== expectedVersion) {
    errors.push(`Packed version ${packResult.version} does not match ${expectedVersion}.`);
  }
  if (!packResult.integrity || !packResult.shasum) {
    errors.push(`${expectedName} pack output is missing integrity or shasum.`);
  }
  if (packResult.size >= 256 * 1024 * 1024) {
    errors.push(`${expectedName} exceeds the 256 MB GitHub Packages limit.`);
  }

  const files = filesByPath(packResult);
  for (const required of REQUIRED_FILES) {
    if (!files.has(required)) errors.push(`${expectedName} is missing required file ${required}.`);
  }
  for (const file of files.values()) {
    if (FORBIDDEN_PREFIXES.some((prefix) => file.path.startsWith(prefix))) {
      errors.push(`${expectedName} includes non-distributable path ${file.path}.`);
    }
    if (/(^|\/)[^/]*\.(test|spec)\.[^/]+$/.test(file.path)) {
      errors.push(`${expectedName} includes test file ${file.path}.`);
    }
    if (file.path.endsWith('.npmrc')) {
      errors.push(`${expectedName} includes registry configuration ${file.path}.`);
    }
  }
  return errors;
}

export function collectPackageErrors(manifest, packageJson) {
  const errors = [];
  if (manifest.schemaVersion !== 1) errors.push('Pack manifest schemaVersion must be 1.');
  if (packageJson.name !== 'dynamoblobs') {
    errors.push(`Canonical npm package name must be dynamoblobs, not ${packageJson.name}.`);
  }
  if (manifest.sourceName !== packageJson.name || manifest.sourceVersion !== packageJson.version) {
    errors.push('Pack manifest source identity does not match package.json.');
  }
  if (packageJson.publishConfig?.registry) {
    errors.push('package.json must stay registry-neutral; workflows select each registry explicitly.');
  }
  if (packageJson.repository?.url !== 'https://github.com/mzebley/dynamoblobs.git') {
    errors.push(
      'package.json repository.url must exactly match https://github.com/mzebley/dynamoblobs.git.',
    );
  }
  if (packageJson.license !== 'MIT') errors.push('package.json license must remain MIT.');
  if (JSON.stringify(packageJson.files) !== JSON.stringify(['dist'])) {
    errors.push('package.json files must remain exactly ["dist"].');
  }

  errors.push(
    ...collectOnePackageErrors(manifest.npm, 'dynamoblobs', manifest.releaseVersion),
    ...collectOnePackageErrors(
      manifest.github,
      '@mzebley/dynamoblobs',
      manifest.releaseVersion,
    ),
  );

  const npmFiles = filesByPath(manifest.npm);
  const githubFiles = filesByPath(manifest.github);
  const npmPaths = [...npmFiles.keys()].sort();
  const githubPaths = [...githubFiles.keys()].sort();
  if (JSON.stringify(npmPaths) !== JSON.stringify(githubPaths)) {
    errors.push('npm and GitHub Packages tarballs do not contain the same paths.');
  } else {
    for (const filePath of npmPaths.filter((value) => value !== 'package.json')) {
      const npmFile = npmFiles.get(filePath);
      const githubFile = githubFiles.get(filePath);
      if (npmFile.size !== githubFile.size || npmFile.mode !== githubFile.mode) {
        errors.push(`Registry tarballs differ at ${filePath}.`);
      }
    }
  }

  return errors;
}

export function localTarballSpec(manifestPath, filename) {
  const tarball = path.posix.join(
    path.dirname(manifestPath).split(path.sep).join(path.posix.sep),
    filename,
  );
  if (path.isAbsolute(manifestPath) || tarball === '..' || tarball.startsWith('../')) {
    return tarball;
  }
  return `./${tarball}`;
}

function tarEntry(tarball, filePath) {
  return execFileSync('tar', ['-xOf', tarball, `package/${filePath}`], {
    encoding: 'buffer',
    maxBuffer: 10 * 1024 * 1024,
  });
}

function actualIntegrity(tarball) {
  return `sha512-${crypto.createHash('sha512').update(fs.readFileSync(tarball)).digest('base64')}`;
}

function collectActualTarballErrors(manifest, manifestPath) {
  const errors = [];
  const npmTarball = localTarballSpec(manifestPath, manifest.npm.filename);
  const githubTarball = localTarballSpec(manifestPath, manifest.github.filename);

  for (const [label, tarball, expected] of [
    ['npm', npmTarball, manifest.npm.integrity],
    ['GitHub Packages', githubTarball, manifest.github.integrity],
  ]) {
    if (!fs.existsSync(tarball)) {
      errors.push(`${label} tarball is missing at ${tarball}.`);
    } else if (actualIntegrity(tarball) !== expected) {
      errors.push(`${label} tarball bytes do not match the recorded integrity.`);
    }
  }
  if (errors.length > 0) return errors;

  for (const filePath of REQUIRED_FILES.filter((value) => value !== 'package.json')) {
    if (!tarEntry(npmTarball, filePath).equals(tarEntry(githubTarball, filePath))) {
      errors.push(`Registry tarball bytes differ at ${filePath}.`);
    }
  }

  const npmPackage = JSON.parse(tarEntry(npmTarball, 'package.json').toString('utf8'));
  const githubPackage = JSON.parse(tarEntry(githubTarball, 'package.json').toString('utf8'));
  githubPackage.name = npmPackage.name;
  if (JSON.stringify(githubPackage) !== JSON.stringify(npmPackage)) {
    errors.push('Registry package.json files differ by more than the required scoped mirror name.');
  }

  return errors;
}

function run() {
  const manifestPath = process.argv[2];
  if (!manifestPath) {
    console.error('Usage: node scripts/release/check-package.mjs <pack.json>');
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const errors = [
    ...collectPackageErrors(manifest, packageJson),
    ...collectActualTarballErrors(manifest, manifestPath),
  ];
  if (errors.length > 0) {
    for (const error of errors) console.error(`::error::${error}`);
    process.exit(1);
  }

  console.error(
    `Package contract: dynamoblobs and @mzebley/dynamoblobs ${manifest.releaseVersion}, ` +
      `${manifest.npm.entryCount} files each.`,
  );
  console.log(`version=${manifest.releaseVersion}`);
  console.log(`npm_tarball=${localTarballSpec(manifestPath, manifest.npm.filename)}`);
  console.log(`npm_integrity=${manifest.npm.integrity}`);
  console.log(`github_tarball=${localTarballSpec(manifestPath, manifest.github.filename)}`);
  console.log(`github_integrity=${manifest.github.integrity}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) run();
