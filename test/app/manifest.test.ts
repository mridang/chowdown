import { describe, expect, it } from '@jest/globals';
import { existsSync } from 'node:fs';
import path from 'node:path';

import manifest from '../../src/app/manifest';

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

  it('turns the browser bar the brand yellow, with the page colour behind the splash', () => {
    expect(m.theme_color).toBe('#ffb100');
    expect(m.background_color).toBe('#fbf8f2');
  });

  it('starts inside its own scope', () => {
    expect(m.start_url!.startsWith(m.scope!)).toBe(true);
  });
});
