/**
 * Runs after the OpenNext build and before the deploy. It writes, into the
 * assets folder that gets uploaded:
 *
 *  - a `.br` copy of every built script and stylesheet, compressed with brotli
 *    at its strongest setting (see `src/lib/http/precompressed.ts` for why), and
 *  - `preload.json`, the scripts every page needs, which the Worker turns into a
 *    `Link: …; rel=preload` header (see `src/lib/http/preload.ts`).
 */

import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompress, constants } from 'node:zlib';
import { promisify } from 'node:util';

const compress = promisify(brotliCompress);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const assets = path.join(root, '.open-next/assets');

/** Every file under a folder, recursively. */
async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(full)));
    } else {
      out.push(full);
    }
  }
  return out;
}

const files = (await walk(path.join(assets, '_next/static'))).filter((f) =>
  /\.(js|css)$/.test(f),
);
let before = 0;
let after = 0;
for (const file of files) {
  const source = await readFile(file);
  // Tiny files cost more in headers than they save.
  if (source.length < 1024) {
    continue;
  }
  const packed = await compress(source, {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY,
      [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT,
      [constants.BROTLI_PARAM_SIZE_HINT]: source.length,
      [constants.BROTLI_PARAM_LGWIN]: 24,
    },
  });
  await writeFile(`${file}.br`, packed);
  before += source.length;
  after += packed.length;
}

const manifest = JSON.parse(
  await readFile(path.join(root, '.next/build-manifest.json'), 'utf8'),
);
await writeFile(
  path.join(assets, 'preload.json'),
  JSON.stringify(manifest.rootMainFiles ?? []),
);

const saved = before ? Math.round((1 - after / before) * 100) : 0;
console.log(
  `brotli: ${files.length} files, ${(before / 1024).toFixed(0)} KB -> ${(after / 1024).toFixed(0)} KB (${saved}% smaller)`,
);
await stat(path.join(assets, 'preload.json'));
