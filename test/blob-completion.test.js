import assert from 'node:assert/strict';
import { getEventListeners } from 'node:events';
import { test } from 'node:test';
import { generateBlobAndWait } from '../src/lib/blobCompletion.js';

for (const outcome of ['event', 'timeout', 'abort', 'throw']) {
  test(`completion wait releases resources after ${outcome}`, async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const clear = t.mock.method(globalThis, 'clearTimeout');
    const controller = new AbortController();
    const blob = new EventTarget();
    let generations = 0;
    blob.generateNewBlob = () => {
      generations++;
      if (outcome === 'throw') throw new Error('generation failed');
    };
    const done = generateBlobAndWait(blob, 500, controller.signal);
    if (outcome === 'throw') {
      await assert.rejects(done, /generation failed/);
    } else {
      assert.equal(getEventListeners(blob, 'dynamo-blob-complete').length, 1);
      if (outcome === 'event') blob.dispatchEvent(new Event('dynamo-blob-complete'));
      if (outcome === 'timeout') t.mock.timers.tick(680);
      if (outcome === 'abort') controller.abort();
      assert.equal(await done, outcome !== 'abort');
    }
    assert.equal(generations, 1);
    assert.equal(getEventListeners(blob, 'dynamo-blob-complete').length, 0);
    assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
    assert.equal(clear.mock.callCount(), 1);
    t.mock.timers.tick(1000);
    assert.equal(clear.mock.callCount(), 1, 'no timeout callback survives cleanup');
  });
}

test('an ended component lifetime does not start generation', async () => {
  const controller = new AbortController();
  controller.abort();
  const blob = new EventTarget();
  blob.generateNewBlob = () => assert.fail('generation after unmount');
  assert.equal(await generateBlobAndWait(blob, 500, controller.signal), false);
  assert.equal(getEventListeners(blob, 'dynamo-blob-complete').length, 0);
});
