import { expect } from '@jest/globals';
import { readFileSync } from 'node:fs';

import sharp from 'sharp';

/** The width and height a PNG file declares in its IHDR header chunk. */
export function pngSize(file: string): { width: number; height: number } {
  const bytes = readFileSync(file);
  // 8-byte signature, then the IHDR chunk: 4 length, 4 type, 4 width, 4 height.
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

/**
 * Whether every pixel of a PNG file is fully opaque (a file may carry an alpha
 * channel and still have no transparent pixel, as the home-screen icon does).
 */
export async function pngIsOpaque(file: string): Promise<boolean> {
  const { channels } = await sharp(file).stats();
  const alpha = channels[3];
  return alpha === undefined || alpha.min === 255;
}
