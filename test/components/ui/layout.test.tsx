import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from '@jest/globals';

import {
  Container,
  Eyebrow,
  Heading,
  Section,
  SectionHeader,
} from '../../../src/components/ui/layout';
import { classOf, html } from '../render';

describe('Eyebrow', () => {
  it('is a tracked-caps paragraph in the accent colour by default', () => {
    const out = html(<Eyebrow>Your collection</Eyebrow>);
    expect(out.startsWith('<p')).toBe(true);
    expect(classOf(out, 'p')).toContain('uppercase');
    expect(classOf(out, 'p')).toContain('text-ember');
  });

  it('takes its colour from the tone, one at a time', () => {
    expect(classOf(html(<Eyebrow tone="ink">x</Eyebrow>), 'p')).toContain(
      'text-ink',
    );
    expect(classOf(html(<Eyebrow tone="ink">x</Eyebrow>), 'p')).not.toContain(
      'text-ember',
    );
    expect(classOf(html(<Eyebrow tone="subtle">x</Eyebrow>), 'p')).toContain(
      'text-subtle',
    );
  });

  it('can label a term or a heading instead of being a paragraph', () => {
    expect(html(<Eyebrow as="dt">Serves</Eyebrow>).startsWith('<dt')).toBe(
      true,
    );
    expect(html(<Eyebrow as="h3">Cookware</Eyebrow>).startsWith('<h3')).toBe(
      true,
    );
  });

  it('is never given a colour class by a caller, since classes are joined and not merged', () => {
    // Two colour classes on one element are decided by the order Tailwind
    // generated them in, not by the order they were written. The tone prop is
    // the way to choose a colour.
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const file = path.join(dir, name);
        if (statSync(file).isDirectory()) {
          walk(file);
        } else if (
          file.endsWith('.tsx') &&
          !file.includes(`${path.sep}views${path.sep}`)
        ) {
          const source = readFileSync(file, 'utf8');
          for (const match of source.matchAll(
            /<Eyebrow\b[^>]*className="([^"]*)"/g,
          )) {
            if (/\btext-(ink|ember|subtle|muted|white)\b/.test(match[1]!)) {
              offenders.push(`${file}: ${match[1]}`);
            }
          }
        }
      }
    };
    walk(path.join(process.cwd(), 'src'));
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
    expect(out).toMatch(/<h1 tabindex="-1" class=/);
    expect(html(<Heading>Title</Heading>)).not.toContain('tabindex');
  });

  it('is an h2 in the display face unless told otherwise', () => {
    const out = html(<Heading>Title</Heading>);
    expect(out.startsWith('<h2')).toBe(true);
    expect(classOf(out, 'h2')).toContain('font-display');
  });

  it('sets the tag and the size separately', () => {
    const out = html(
      <Heading as="h1" variant="display">
        Big
      </Heading>,
    );
    expect(out.startsWith('<h1')).toBe(true);
    expect(classOf(out, 'h1')).toContain('text-5xl');
  });
});

describe('SectionHeader', () => {
  it('shows the eyebrow above the title, and an action beside them', () => {
    const out = html(
      <SectionHeader
        eyebrow="Weeknight"
        title="Easy and quick"
        action={<a href="/all">All</a>}
      />,
    );
    expect(out.indexOf('Weeknight')).toBeLessThan(
      out.indexOf('Easy and quick'),
    );
    expect(out).toContain('href="/all"');
  });

  it('has no eyebrow when none is given', () => {
    expect(html(<SectionHeader title="Only a title" />)).not.toContain(
      'uppercase',
    );
  });
});

describe('Container', () => {
  it('centres the content in the page column', () => {
    expect(classOf(html(<Container>x</Container>), 'div')).toContain('mx-auto');
  });
});

describe('Section', () => {
  it('is a landmark band that header links can jump to', () => {
    const out = html(<Section id="faq">x</Section>);
    expect(out.startsWith('<section')).toBe(true);
    expect(out).toContain('id="faq"');
  });

  it('is the page colour unless told otherwise', () => {
    expect(classOf(html(<Section>x</Section>), 'section')).toContain(
      'bg-paper',
    );
    expect(
      classOf(html(<Section surface="white">x</Section>), 'section'),
    ).toContain('bg-white');
  });
});
