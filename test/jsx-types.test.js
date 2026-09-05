import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import ts from 'typescript';

// Compile consumers against authored declarations; package export checks cover
// the generated declaration entry points separately.
function checkConsumer(source) {
  const fileName = fileURLToPath(new URL('./jsx-consumer.tsx', import.meta.url));
  const options = { noEmit: true, strict: true, types: [], jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.ESNext };
  const host = ts.createCompilerHost(options);
  const readSource = host.getSourceFile.bind(host);
  host.getSourceFile = (name, ...args) => name === fileName
    ? ts.createSourceFile(name, source, options.target, true, ts.ScriptKind.TSX)
    : readSource(name, ...args);
  const diagnostics = ts.getPreEmitDiagnostics(ts.createProgram([fileName], options, host));
  assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCurrentDirectory: () => process.cwd(), getCanonicalFileName: name => name, getNewLine: () => '\n',
  }));
}

test('JSX accepts host attributes and preserves custom-element constraints', () => {
  checkConsumer(`
    import '../src/dynamoblobs';
    const blob = <dynamo-blob id="example" class="blob" className="alternate"
      tabIndex={0} role="button" aria-label="Deflect" aria-hidden={false}
      data-owner="example" onclick={event => event.clientX.toFixed()} style={{ width: 120, '--fill': 'plum' }}
      data-blob-points="10" data-blob-drift-start-position="center" />;
    const inline = <dynamo-blob style="width:120px" hidden />;
    // @ts-expect-error The custom position remains a constrained union.
    const badPosition: JSX.IntrinsicElements['dynamo-blob'] = { 'data-blob-drift-start-position': 'left' };
    // @ts-expect-error Host id remains a string.
    const badId = <dynamo-blob id={42} />;
  `);
  checkConsumer(`
    import '../src/dynamoblobs';
    declare global {
      namespace JSX {
        interface IntrinsicElements {
          div: { id?: string; onClick?: (event: { frameworkValue: number }) => void; ref?: { current: HTMLElement | null } };
        }
      }
    }
    const blob = <dynamo-blob id="example" data-blob-points="10"
      ref={{ current: null }} onClick={event => event.frameworkValue.toFixed()} />;
    // @ts-expect-error Keep the framework event contract.
    const badHandler = <dynamo-blob onClick={(event: string) => {}} />;
  `);
});
