import assert from 'node:assert/strict';
import test from 'node:test';
import { extractPackJson } from './pack-package.mjs';

test('extracts one npm pack result after lifecycle output', () => {
  const output = `Building dist...\n[\n  {\n    "filename": "dynamoblobs-1.0.0.tgz",\n    "name": "dynamoblobs",\n    "version": "1.0.0"\n  }\n]\n`;
  assert.deepEqual(extractPackJson(output), {
    log: 'Building dist...',
    result: {
      filename: 'dynamoblobs-1.0.0.tgz',
      name: 'dynamoblobs',
      version: '1.0.0',
    },
  });
});

test('rejects output without one package result', () => {
  assert.throws(() => extractPackJson('prepare completed'), /did not emit/);
});
