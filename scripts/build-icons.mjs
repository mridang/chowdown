/**
 * Draws the app icons (installed-app icons, the iOS home-screen icon, the
 * Android themed icon and the favicons) from one shape, so they always match.
 * Run with `node scripts/build-icons.mjs` after changing the mark; the PNGs,
 * SVG and ICO it writes are committed.
 *
 * One thing is not reproducible yet: the social card's words are drawn with
 * whatever Helvetica-like font the machine has (see SOCIAL below), so re-running
 * this on another machine can move the text by a pixel or two.
 */

import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MARIGOLD = '#ffb100';
const FLAME = '#ff4e00';
const INK = '#15120e';

/**
 * A frying pan with a flame-coloured yolk on the brand yellow. `scale` shrinks
 * the mark toward the centre, which maskable icons need: the operating system
 * may crop the outer fifth into a circle or squircle.
 */
function mark(scale) {
  return `<g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
    <path d="M318 214 448 130" stroke="${INK}" stroke-width="44" stroke-linecap="round" fill="none"/>
    <circle cx="228" cy="284" r="132" fill="${INK}"/>
    <circle cx="228" cy="284" r="56" fill="${FLAME}"/>
  </g>`;
}

/** The icon as SVG: a full-bleed square, or a rounded one for the favicon. */
function svg({ scale, radius }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${radius}" fill="${MARIGOLD}"/>
  ${mark(scale)}
</svg>`;
}

/** The icon rendered to PNG bytes at `size` pixels square. */
function pngBytes(size, options) {
  return sharp(Buffer.from(svg(options)), { density: 384 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function png(name, size, options) {
  await writeFile(path.join(root, name), await pngBytes(size, options));
}

/**
 * The themed-icon version for Android 13+: only the alpha channel is used (the
 * system colours it), so it is the pan and handle in solid black on a
 * transparent square, with the yolk cut out as a hole. Drawn at the maskable
 * size so the mark stays inside the safe zone.
 */
const MONOCHROME = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <mask id="yolk" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">
      <rect width="512" height="512" fill="#fff"/>
      <circle cx="228" cy="284" r="56" fill="#000"/>
    </mask>
  </defs>
  <g transform="translate(256 256) scale(0.72) translate(-256 -256)" mask="url(#yolk)">
    <path d="M318 214 448 130" stroke="#000" stroke-width="44" stroke-linecap="round" fill="none"/>
    <circle cx="228" cy="284" r="132" fill="#000"/>
  </g>
</svg>`;

/**
 * An ICO file holding the given square PNG images. Every current browser reads
 * PNG-in-ICO, and sharp cannot write ICO itself. The file is a 6-byte header,
 * one 16-byte directory entry per image, then the images back to back.
 */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2); // type 1 = icon
  header.writeUInt16LE(images.length, 4);
  const dataStart = 6 + 16 * images.length;
  const entries = images.map(({ size, data }, i) => {
    const offset =
      dataStart + images.slice(0, i).reduce((sum, p) => sum + p.data.length, 0);
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size, 0); // width (0 would mean 256)
    entry.writeUInt8(size, 1); // height
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    return entry;
  });
  return Buffer.concat([header, ...entries, ...images.map((p) => p.data)]);
}

await png('public/icons/icon-192.png', 192, { scale: 1, radius: 0 });
await png('public/icons/icon-512.png', 512, { scale: 1, radius: 0 });
await png('public/icons/icon-maskable-512.png', 512, {
  scale: 0.72,
  radius: 0,
});
await png('src/app/apple-icon.png', 180, { scale: 0.86, radius: 0 });
await writeFile(
  path.join(root, 'src/app/icon.svg'),
  svg({ scale: 1, radius: 112 }),
);
await sharp(Buffer.from(MONOCHROME), { density: 384 })
  .resize(512, 512)
  .png({ compressionLevel: 9 })
  .toFile(path.join(root, 'public/icons/icon-monochrome-512.png'));
// Safari, feed readers, link unfurlers and uptime monitors ask for
// /favicon.ico whatever the page's <link> says, and each miss would otherwise
// render the whole not-found page.
const faviconSizes = [16, 32, 48];
await writeFile(
  path.join(root, 'src/app/favicon.ico'),
  ico(
    await Promise.all(
      faviconSizes.map(async (size) => ({
        size,
        data: await pngBytes(size, { scale: 1, radius: 112 }),
      })),
    ),
  ),
);
/**
 * The picture shown when a link to the site is shared (Open Graph and the
 * Twitter large card): the brand yellow, the name, the promise, and the pan
 * mark, with the footer's flame zigzag along the bottom.
 */
const SOCIAL = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${MARIGOLD}"/>
  <path fill="${FLAME}" d="M0 630V545L330 505 520 535 800 480 1200 545V630Z"/>
  <g transform="translate(720 70) scale(0.95)">
    <path d="M318 214 448 130" stroke="${INK}" stroke-width="44" stroke-linecap="round" fill="none"/>
    <circle cx="228" cy="284" r="132" fill="${INK}"/>
    <circle cx="228" cy="284" r="56" fill="${FLAME}"/>
  </g>
  <text x="80" y="200" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="128" font-weight="800" fill="${INK}" letter-spacing="-3">chowdown</text>
  <text x="84" y="275" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="26" font-weight="700" fill="${INK}" letter-spacing="7">RECIPE KEEPER</text>
  <text x="80" y="390" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="52" font-weight="700" fill="${INK}">Your recipes. Your Drive.</text>
  <text x="80" y="452" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="52" font-weight="700" fill="${INK}">Your rules.</text>
</svg>`;

// Two files with the same bytes on purpose: Next emits og:image and
// twitter:image from these file names, and the privacy page names both.
for (const name of ['opengraph-image.png', 'twitter-image.png']) {
  await sharp(Buffer.from(SOCIAL), { density: 144 })
    .resize(1200, 630)
    .png({ compressionLevel: 9 })
    .toFile(path.join(root, 'src/app', name));
}
console.log('icons written');
