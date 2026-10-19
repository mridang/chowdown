import { describe, expect, it } from '@jest/globals';
import { existsSync } from 'node:fs';
import path from 'node:path';

import manifest from '../../src/app/manifest';
import { pngSize } from '../png';

describe('web app manifest', () => {
  const m = manifest();

  it('meets what Chrome needs to offer an install', () => {
    expect(m.name).toBeTruthy();
    expect(m.short_name).toBeTruthy();
    expect(m.display).toBe('standalone');
    expect(m.start_url).toMatch(/^\//);
    const sizes = (m.icons ?? []).map((i) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
  });

  it('has a maskable icon so Android does not shrink it inside a white circle', () => {
    expect((m.icons ?? []).some((i) => i.purpose === 'maskable')).toBe(true);
  });

  it('points every icon at a file that exists', () => {
    for (const icon of m.icons ?? []) {
      expect(existsSync(path.join(process.cwd(), 'public', icon.src))).toBe(
        true,
      );
    }
  });

  it('declares each icon at the size the file really has', () => {
    for (const icon of m.icons ?? []) {
      const { width, height } = pngSize(
        path.join(process.cwd(), 'public', icon.src),
      );
      expect(icon.sizes).toBe(`${width}x${height}`);
    }
  });

  it('has a monochrome icon for Android themed icons', () => {
    const mono = (m.icons ?? []).filter((i) => i.purpose === 'monochrome');
    expect(mono.map((i) => i.sizes)).toEqual(['512x512']);
  });

  it('reuses the open window when the installed app is launched again', () => {
    expect(m.launch_handler).toEqual({ client_mode: 'navigate-existing' });
  });

  it('points every shortcut inside its scope', () => {
    for (const shortcut of m.shortcuts ?? []) {
      expect(shortcut.url.startsWith(m.scope!)).toBe(true);
    }
  });

  it('turns the browser bar the brand yellow, with the page colour behind the splash', () => {
    expect(m.theme_color).toBe('#ffb100');
    expect(m.background_color).toBe('#fbf8f2');
  });

  // Chrome only shows the rich install dialog when a screenshot of each form
  // factor exists; whatever is declared must be a real, correctly sized file.
  it('declares screenshots Chrome will accept, if any', () => {
    const shots = m.screenshots ?? [];
    for (const shot of shots) {
      const { width, height } = pngSize(
        path.join(process.cwd(), 'public', shot.src),
      );
      expect(shot.sizes).toBe(`${width}x${height}`);
      expect(Math.min(width, height)).toBeGreaterThanOrEqual(320);
      expect(Math.max(width, height)).toBeLessThanOrEqual(3840);
      expect(
        Math.max(width, height) / Math.min(width, height),
      ).toBeLessThanOrEqual(2.3);
      expect(['wide', 'narrow']).toContain(shot.form_factor);
    }
    for (const factor of ['wide', 'narrow']) {
      const ratios = new Set(
        shots.filter((s) => s.form_factor === factor).map((s) => s.sizes),
      );
      expect(ratios.size).toBeLessThanOrEqual(1);
    }
  });

  it('starts inside its own scope', () => {
    expect(m.start_url!.startsWith(m.scope!)).toBe(true);
  });
});
