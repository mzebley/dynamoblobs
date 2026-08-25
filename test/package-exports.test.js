import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';
import { runInNewContext } from 'node:vm';

const publicRuntimeExports = ['DynamoBlob', 'createSeededRandom', 'decodeBlobSeed', 'encodeBlobSeed', 'generateBlobPath', 'generateBlobPoints', 'interpolateBlob', 'nextMorphShape', 'parseBlobPath', 'resampleClosed'].sort();

describe('package exports', () => {
  it('has identical ESM and CommonJS public APIs', async () => {
    const esm = await import('dynamoblobs');
    const require = createRequire(import.meta.url);
    assert.deepEqual(Object.keys(esm).sort(), publicRuntimeExports);
    assert.deepEqual(Object.keys(require('dynamoblobs')).sort(), publicRuntimeExports);
  });

  it('keeps UMD global registration for direct-script consumers', () => {
    const definitions = new Map();
    const context = { HTMLElement: class HTMLElement {}, customElements: { define(name, constructor) { definitions.set(name, constructor); }, get(name) { return definitions.get(name); } } };
    context.window = context; context.self = context;
    runInNewContext(readFileSync(new URL('../dist/dynamoblobs.js', import.meta.url), 'utf8'), context);
    assert.deepEqual(Object.keys(context.Dynamoblobs).sort(), publicRuntimeExports);
    assert.equal(definitions.get('dynamo-blob'), context.Dynamoblobs.DynamoBlob);
  });
});
