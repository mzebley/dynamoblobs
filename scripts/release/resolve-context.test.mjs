import assert from 'node:assert/strict';
import test from 'node:test';
import { selectReleasePullRequest } from './resolve-context.mjs';

test('selects only the exact merged release PR for a production version', () => {
  const pullRequests = [
    {
      number: 8,
      merged_at: '2026-08-25T12:00:00Z',
      base: { ref: 'main' },
      head: { ref: 'release/v1.0.0', sha: 'candidate' },
      title: 'release: v1.0.0',
    },
    {
      number: 7,
      merged_at: '2026-08-25T11:00:00Z',
      base: { ref: 'main' },
      head: { ref: 'feat/blob', sha: 'feature' },
      title: 'Blob feature',
    },
  ];
  assert.deepEqual(selectReleasePullRequest(pullRequests, '1.0.0'), [pullRequests[0]]);
});

test('rejects release-looking PRs with mismatched title, branch, or merge state', () => {
  const pullRequests = [
    {
      merged_at: null,
      base: { ref: 'main' },
      head: { ref: 'release/v1.0.0' },
      title: 'release: v1.0.0',
    },
    {
      merged_at: '2026-08-25T12:00:00Z',
      base: { ref: 'main' },
      head: { ref: 'release/v1.0.1' },
      title: 'release: v1.0.1',
    },
  ];
  assert.deepEqual(selectReleasePullRequest(pullRequests, '1.0.0'), []);
});
