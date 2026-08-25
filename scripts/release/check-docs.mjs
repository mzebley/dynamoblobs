#!/usr/bin/env node

import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const DOC_PATHS = [
  'README.md',
  'src/lib/content/installation.md',
  'src/lib/content/usage.md',
  'src/lib/content/api.md',
  'src/lib/content/examples.md',
];

function unique(values) {
  return [...new Set(values)];
}

export function collectDocsErrors({ packageJson, declarations, documents, navSource }) {
  const errors = [];
  const readme = documents['README.md'] ?? '';
  const installation = documents['src/lib/content/installation.md'] ?? '';
  const api = documents['src/lib/content/api.md'] ?? '';
  const examples = documents['src/lib/content/examples.md'] ?? '';
  const installCommand = `npm install ${packageJson.name}`;

  for (const [path, content] of [
    ['README.md', readme],
    ['src/lib/content/installation.md', installation],
  ]) {
    if (!content.includes(installCommand)) {
      errors.push(`${path} must contain the canonical install command: ${installCommand}`);
    }
    if (!content.includes(`'${packageJson.name}'`)) {
      errors.push(`${path} must import the canonical package name '${packageJson.name}'.`);
    }
  }

  const packageUrl = `https://www.npmjs.com/package/${packageJson.name}`;
  if (!navSource.includes(packageUrl)) {
    errors.push(`Documentation navigation must link to ${packageUrl}.`);
  }
  if (!readme.includes(packageJson.homepage)) {
    errors.push(`README.md must link to the package homepage ${packageJson.homepage}.`);
  }

  const attributeBlock = /interface DynamoBlobAttributes \{([\s\S]*?)\n\}/.exec(declarations)?.[1] ?? '';
  const attributes = unique([...attributeBlock.matchAll(/'(data-blob-[^']+)'/g)].map((match) => match[1]));
  for (const attribute of attributes) {
    if (!api.includes(`\`${attribute}\``)) {
      errors.push(`API documentation is missing declared attribute ${attribute}.`);
    }
  }

  const classBlock = /declare class DynamoBlob[\s\S]*?\n\}/.exec(declarations)?.[0] ?? '';
  const methods = unique(
    [...classBlock.matchAll(/^  (?!private |constructor|connectedCallback|disconnectedCallback|attributeChangedCallback)([a-zA-Z][a-zA-Z0-9]*)\([^;]*\): this;/gm)]
      .map((match) => match[1]),
  );
  for (const method of methods) {
    if (!api.includes(`\`${method}(`) && !api.includes(`.${method}(`)) {
      errors.push(`API documentation is missing public method ${method}().`);
    }
  }

  const exportBlock = /export \{([\s\S]*?)\};\s*$/.exec(declarations)?.[1] ?? '';
  const exports = unique(
    exportBlock
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean),
  );
  for (const name of exports) {
    if (!api.includes(`\`${name}\``) && !api.includes(name)) {
      errors.push(`API documentation is missing declared export ${name}.`);
    }
  }

  if (!api.includes('`dynamo-blob-complete`')) {
    errors.push('API documentation must describe the dynamo-blob-complete event.');
  }
  if (!examples.includes(`from '${packageJson.name}'`)) {
    errors.push(`Examples must import from '${packageJson.name}'.`);
  }

  return errors;
}

function run() {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const declarations = fs.readFileSync('src/dynamoblobs.d.ts', 'utf8');
  const documents = Object.fromEntries(
    DOC_PATHS.map((path) => [path, fs.readFileSync(path, 'utf8')]),
  );
  const navSource = [
    fs.readFileSync('src/lib/components/DocsNav.svelte', 'utf8'),
    fs.readFileSync('src/lib/components/DocsFooter.svelte', 'utf8'),
  ].join('\n');
  const errors = collectDocsErrors({ packageJson, declarations, documents, navSource });

  if (errors.length > 0) {
    for (const error of errors) console.error(`::error::${error}`);
    process.exit(1);
  }

  console.log(
    `Documentation contract: ${packageJson.name}, declared attributes, methods, exports, and event are covered.`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) run();
