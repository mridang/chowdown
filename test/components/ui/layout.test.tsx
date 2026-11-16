import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from '@jest/globals';

import { Container, Eyebrow, Heading } from '@/components/ui/layout';
import { cssClassesOf, html } from '../render';

const H1_TABINDEX_CLASS = /<h1 tabindex="-1" class=/;
const TEXT_INK_ACCENT = /\btext-(ink|accent|subtle|muted|on-ink)\b/;

describe('Eyebrow', () => {
  it('is a tracked-caps paragraph in the accent colour by default', () => {
    const out = html(<Eyebrow>Your collection</Eyebrow>);
    expect(out.startsWith('<p')).toBe(true);
    expect(cssClassesOf(out, 'p')).toContain('uppercase');
    expect(cssClassesOf(out, 'p')).toContain('text-accent');
  });

  it('takes its colour from the tone, one at a time', () => {
    expect(cssClassesOf(html(<Eyebrow tone="ink">x</Eyebrow>), 'p')).toContain(
      'text-ink',
    );
    expect(
      cssClassesOf(html(<Eyebrow tone="ink">x</Eyebrow>), 'p'),
    ).not.toContain('text-accent');
    expect(
      cssClassesOf(html(<Eyebrow tone="subtle">x</Eyebrow>), 'p'),
    ).toContain('text-subtle');
  });

  it('can label a term or a heading instead of being a paragraph', () => {
    expect(html(<Eyebrow as="dt">Serves</Eyebrow>).startsWith('<dt')).toBe(
      true,
    );
    expect(html(<Eyebrow as="h3">Cookware</Eyebrow>).startsWith('<h3')).toBe(
      true,
    );
  });

  it('is never given a colour class by a caller, since classes are joined and not merged', async () => {
    // Two colour classes on one element are decided by the order Tailwind
    // generated them in, not by the order they were written. The tone prop is
    // the way to choose a colour.
    const offenders: string[] = [];
    const walk = async (dir: string): Promise<void> => {
      for (const name of await readdir(dir)) {
        const file = path.join(dir, name);
        const info = await stat(file);
        if (info.isDirectory()) {
          await walk(file);
        } else if (
          file.endsWith('.tsx') &&
          !file.includes(`${path.sep}views${path.sep}`)
        ) {
          const source = await readFile(file, 'utf8');
          const cssClasses = Array.from(
            source.matchAll(/<Eyebrow\b[^>]*className="([^"]*)"/g),
            (match) => match[1]!,
          );
          offenders.push(
            ...cssClasses
              .filter((names) => TEXT_INK_ACCENT.test(names))
              .map((names) => `${file}: ${names}`),
          );
        } else {
          // Other files cannot hold an Eyebrow call site with a colour class.
        }
      }
    };
    await walk(path.join(process.cwd(), 'src'));
    expect(offenders).toEqual([]);
  });
});

describe('Heading', () => {
  it('can be made focusable by script, for moving focus to it between steps', () => {
    const out = html(
      <Heading as="h1" tabIndex={-1}>
        Title
      </Heading>,
    );
    expect(out).toMatch(H1_TABINDEX_CLASS);
    expect(html(<Heading>Title</Heading>)).not.toContain('tabindex');
  });

  it('is an h2 in the display face unless told otherwise', () => {
    const out = html(<Heading>Title</Heading>);
    expect(out.startsWith('<h2')).toBe(true);
    expect(cssClassesOf(out, 'h2')).toContain('font-display');
  });

  it('sets the tag and the size separately', () => {
    const out = html(
      <Heading as="h1" variant="display">
        Big
      </Heading>,
    );
    expect(out.startsWith('<h1')).toBe(true);
    expect(cssClassesOf(out, 'h1')).toContain('text-5xl');
  });
});

describe('Container', () => {
  it('centres the content in the page column', () => {
    expect(cssClassesOf(html(<Container>x</Container>), 'div')).toContain(
      'mx-auto',
    );
  });
});
