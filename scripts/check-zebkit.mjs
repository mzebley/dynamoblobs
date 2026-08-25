#!/usr/bin/env node

import path from 'node:path';
import { spawnSync } from 'node:child_process';

const executable = path.join(
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'zebkit.cmd' : 'zebkit',
);
const result = spawnSync(executable, ['check', '--format=json'], {
  encoding: 'utf8',
  maxBuffer: 256 * 1024 * 1024,
});

if (result.stderr) process.stderr.write(result.stderr);
if (result.error) throw result.error;

let report;
try {
  report = JSON.parse(result.stdout);
} catch (error) {
  process.stderr.write(result.stdout);
  throw new Error(`Zebkit did not emit valid JSON: ${error.message}`);
}

console.log(
  JSON.stringify(
    {
      findings: report.findings?.length ?? 0,
      coverage: report.coverage,
      staticEnforcement: report.staticEnforcement,
      staticCounts: report.staticEvidence?.counts,
    },
    null,
    2,
  ),
);

if (result.status !== 0) process.exitCode = result.status ?? 1;
