#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { parseCandidateVersion, parseStableVersion } from './release-contract.mjs';

const PACKAGE_FILES = ['LICENSE', 'README.md', 'dist'];

export function extractPackJson(output) {
  const candidates = [];
  for (let index = output.indexOf('['); index !== -1; index = output.indexOf('[', index + 1)) {
    candidates.push(index);
  }

  for (const index of candidates.reverse()) {
    try {
      const parsed = JSON.parse(output.slice(index));
      if (Array.isArray(parsed) && parsed.length === 1 && parsed[0]?.filename) {
        return { log: output.slice(0, index).trim(), result: parsed[0] };
      }
    } catch {
      // Lifecycle output can contain earlier "[" characters; keep scanning.
    }
  }

  throw new Error('npm pack did not emit a readable one-package JSON result.');
}

function assertSafeOutputDirectory(outputDirectory) {
  const resolved = path.resolve(outputDirectory);
  const cwd = path.resolve('.');
  const root = path.parse(resolved).root;
  if (resolved === cwd || resolved === root || resolved === path.dirname(cwd)) {
    throw new Error(`Refusing unsafe release output directory ${resolved}.`);
  }
  return resolved;
}

function stagePackage({ stagingDirectory, packageJson, name, version }) {
  fs.mkdirSync(stagingDirectory, { recursive: true });
  for (const source of PACKAGE_FILES) {
    const target = path.join(stagingDirectory, source);
    fs.cpSync(source, target, { recursive: true });
  }

  const stagedPackage = {
    ...packageJson,
    name,
    version,
  };
  delete stagedPackage.publishConfig;
  fs.writeFileSync(
    path.join(stagingDirectory, 'package.json'),
    `${JSON.stringify(stagedPackage, null, 2)}\n`,
  );
}

function pack(stagingDirectory, outputDirectory) {
  const result = spawnSync(
    'npm',
    [
      'pack',
      stagingDirectory,
      '--ignore-scripts',
      '--json',
      '--pack-destination',
      outputDirectory,
    ],
    { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 },
  );

  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    if (result.stdout) process.stderr.write(result.stdout);
    process.exit(result.status ?? 1);
  }

  const extracted = extractPackJson(result.stdout);
  if (extracted.log) process.stderr.write(`${extracted.log}\n`);
  return extracted.result;
}

function run() {
  const outputArgument = process.argv[2];
  const releaseVersion = process.argv[3];
  if (!outputArgument) {
    console.error(
      'Usage: node scripts/release/pack-package.mjs <output-directory> [x.y.z or x.y.z-rc.n]',
    );
    process.exit(1);
  }

  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const version = releaseVersion ?? packageJson.version;
  try {
    parseStableVersion(version);
  } catch (stableError) {
    try {
      parseCandidateVersion(version);
    } catch {
      throw stableError;
    }
  }

  const outputDirectory = assertSafeOutputDirectory(outputArgument);
  const stagingRoot = path.join(outputDirectory, '.staging');
  fs.mkdirSync(outputDirectory, { recursive: true });
  fs.rmSync(stagingRoot, { recursive: true, force: true });

  const npmStaging = path.join(stagingRoot, 'npm');
  const githubStaging = path.join(stagingRoot, 'github');
  stagePackage({
    stagingDirectory: npmStaging,
    packageJson,
    name: packageJson.name,
    version,
  });
  stagePackage({
    stagingDirectory: githubStaging,
    packageJson,
    name: '@mzebley/dynamoblobs',
    version,
  });

  const manifest = {
    schemaVersion: 1,
    sourceName: packageJson.name,
    sourceVersion: packageJson.version,
    releaseVersion: version,
    npm: pack(npmStaging, outputDirectory),
    github: pack(githubStaging, outputDirectory),
  };
  fs.rmSync(stagingRoot, { recursive: true, force: true });

  const manifestPath = path.join(outputDirectory, 'pack.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(manifestPath);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) run();
