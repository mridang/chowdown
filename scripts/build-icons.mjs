/**
 * Draws the app icons (installed-app icons, the iOS home-screen icon and the
 * favicon) from one shape, so they always match. Run with
 * `node scripts/build-icons.mjs` after changing the mark; the PNGs and SVG it
 * writes are committed.
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

async function png(name, size, options) {
  await sharp(Buffer.from(svg(options)), { density: 384 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(path.join(root, name));
}

await png('public/icons/icon-192.png', 192, { scale: 1, radius: 0 });
await png('public/icons/icon-512.png', 512, { scale: 1, radius: 0 });
await png('public/icons/icon-maskable-512.png', 512, { scale: 0.72, radius: 0 });
await png('src/app/apple-icon.png', 180, { scale: 0.86, radius: 0 });
await writeFile(
  path.join(root, 'src/app/icon.svg'),
  svg({ scale: 1, radius: 112 }),
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

for (const name of ['opengraph-image.png', 'twitter-image.png']) {
  await sharp(Buffer.from(SOCIAL), { density: 144 })
    .resize(1200, 630)
    .png({ compressionLevel: 9 })
    .toFile(path.join(root, 'src/app', name));
}
console.log('icons written');
