import { spawn } from 'node:child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const previewUrl = 'http://127.0.0.1:4173/';
let previewLog = '';

function run(command, args, options = {}) {
  return spawn(command, args, { stdio: 'inherit', ...options });
}

function waitForExit(child) {
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });
}

async function waitForPreview(timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(previewUrl);
      if (response.ok) return;
    } catch {
      // Vite has not opened the port yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Preview did not become ready at ${previewUrl} within ${timeoutMs}ms.\n${previewLog}`);
}

const preview = spawn(
  npmCommand,
  ['run', 'preview:docs', '--', '--host', '127.0.0.1', '--port', '4173', '--strictPort'],
  { stdio: ['ignore', 'pipe', 'pipe'] },
);
const previewExit = waitForExit(preview);

for (const stream of [preview.stdout, preview.stderr]) {
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    previewLog = `${previewLog}${chunk}`.slice(-12_000);
    process.stdout.write(chunk);
  });
}

try {
  await Promise.race([
    waitForPreview(),
    previewExit.then(({ code, signal }) => {
      throw new Error(`Preview exited before verification (code ${code}, signal ${signal}).\n${previewLog}`);
    }),
  ]);
  const verification = run(npmCommand, ['run', 'verify:docs']);
  const result = await waitForExit(verification);
  if (result.code !== 0) process.exitCode = result.code ?? 1;
} finally {
  preview.kill('SIGTERM');
  await Promise.race([
    previewExit,
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
  if (preview.exitCode == null) preview.kill('SIGKILL');
}
