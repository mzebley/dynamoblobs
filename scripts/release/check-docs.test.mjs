import assert from 'node:assert/strict';
import test from 'node:test';
import { collectDocsErrors } from './check-docs.mjs';

const packageJson = {
  name: 'dynamoblobs',
  homepage: 'https://dynamoblobs.example.com/',
};
const declarations = `
declare class DynamoBlob extends HTMLElement {
  play(): this;
}
interface DynamoBlobAttributes {
  'data-blob-points'?: string;
}
export { DynamoBlob };
`;
const documents = {
  'README.md': "npm install dynamoblobs\nimport 'dynamoblobs';\nhttps://dynamoblobs.example.com/",
  'src/lib/content/installation.md': "npm install dynamoblobs\nimport 'dynamoblobs';",
  'src/lib/content/usage.md': '',
  'src/lib/content/api.md': '`data-blob-points` `play()` `DynamoBlob` `dynamo-blob-complete`',
  'src/lib/content/examples.md': "import { DynamoBlob } from 'dynamoblobs';",
};
const navSource = 'https://www.npmjs.com/package/dynamoblobs';

test('accepts synchronized package, API, and documentation contracts', () => {
  assert.deepEqual(
    collectDocsErrors({ packageJson, declarations, documents, navSource }),
    [],
  );
});

test('reports package-name and public API documentation drift', () => {
  const errors = collectDocsErrors({
    packageJson: { ...packageJson, name: 'renamed' },
    declarations: declarations.replace('play(): this;', 'pause(): this;'),
    documents,
    navSource,
  }).join('\n');
  assert.match(errors, /canonical install command/);
  assert.match(errors, /public method pause/);
  assert.match(errors, /Documentation navigation/);
});
