// Runs the official MCP conformance suite against this server's request
// handling: bundles scripts/conformance/server.ts, starts it on a free port,
// and runs `conformance server` against it once for each spec revision the
// server speaks (see baselines.mjs), exiting non-zero if any run does. Known
// gaps are listed (with reasons) in expected-failures-<revision>.yml, so a new
// failure fails the run and a fixed gap is reported until it is removed from the
// list. A baseline entry that names a scenario the installed suite no longer has
// fails the run before anything starts.
//
//   node scripts/conformance/run.mjs                      every revision
//   node scripts/conformance/run.mjs --revision 2025-11-25  just that one
//
// Any other argument is handed to the suite.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

import { REVISIONS, baselineFile, checkBaseline } from './baselines.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));

/** The arguments after the script name: which revision to run, and what to pass on. */
const argv = process.argv.slice(2);
const flag = argv.indexOf('--revision');
const only = flag === -1 ? undefined : argv[flag + 1];
const passedOn = argv.filter((_, i) => i !== flag && i !== flag + 1);
const revisions = only === undefined ? REVISIONS : [only];

const unknownRevision = revisions.find((r) => !REVISIONS.includes(r));
if (unknownRevision !== undefined) {
  console.error(
    `Unknown revision "${unknownRevision}"; choose from ${REVISIONS.join(', ')}.`,
  );
  process.exit(2);
}

const stale = revisions.flatMap((revision) =>
  checkBaseline(revision).map((entry) => `${revision}: ${entry}`),
);
if (stale.length > 0) {
  console.error(
    `Baseline entries that name no scenario of the installed suite:\n  ${stale.join('\n  ')}`,
  );
  process.exit(1);
}

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

/**
 * Run the suite for one revision and resolve to its exit status.
 * @param {string} revision
 * @returns {Promise<number>}
 */
async function runSuite(revision) {
  const suite = spawn(
    'npx',
    [
      'conformance',
      'server',
      '--url',
      url,
      '--requirements',
      revision,
      '--expected-failures',
      baselineFile(revision),
      ...passedOn,
    ],
    { stdio: 'inherit' },
  );
  const status = await new Promise((resolve) => suite.once('exit', resolve));
  return typeof status === 'number' ? status : 1;
}

// One after the other: they share a server, and the output stays readable.
const statuses = await revisions.reduce(
  async (done, revision) => [...(await done), await runSuite(revision)],
  Promise.resolve([]),
);
server.kill();
process.exit(statuses.every((status) => status === 0) ? 0 : 1);
