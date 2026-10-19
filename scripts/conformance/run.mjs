// Runs the official MCP conformance suite against this server's request
// handling: bundles scripts/conformance/server.ts, starts it on a free port,
// runs `conformance server` against it for the 2026-07-28 revision, and exits
// with the suite's status. Known gaps are listed (with reasons) in
// expected-failures.yml, so a new failure fails the run and a fixed gap is
// reported until it is removed from the list.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const here = fileURLToPath(new URL('.', import.meta.url));
const work = mkdtempSync(join(tmpdir(), 'chowdown-conformance-'));
const bundle = join(work, 'server.cjs');

await build({
  entryPoints: [join(here, 'server.ts')],
  outfile: bundle,
  bundle: true,
  platform: 'node',
  // CommonJS, because the Next.js code the handlers import expects `__dirname`.
  format: 'cjs',
  target: 'node22',
  logLevel: 'warning',
});

const server = spawn(process.execPath, [bundle], {
  stdio: ['ignore', 'pipe', 'inherit'],
});
const url = await new Promise((resolve, reject) => {
  server.once('exit', (code) => reject(new Error(`server exited (${code})`)));
  server.stdout.on('data', (chunk) => {
    const found = /LISTENING (\S+)/.exec(String(chunk));
    if (found) {
      resolve(found[1]);
    }
  });
});

const suite = spawn(
  'npx',
  [
    'conformance',
    'server',
    '--url',
    url,
    '--requirements',
    '2026-07-28',
    '--expected-failures',
    join(here, 'expected-failures.yml'),
    ...process.argv.slice(2),
  ],
  { stdio: 'inherit' },
);
const status = await new Promise((resolve) => suite.once('exit', resolve));
server.kill();
process.exit(typeof status === 'number' ? status : 1);
