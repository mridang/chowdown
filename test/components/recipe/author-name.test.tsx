import { describe, expect, it } from '@jest/globals';

import { AuthorName, handwritingFor } from '@/components/recipe/author-name';
import { html } from '../render';

/** Real-looking names: every first name with every surname (400 people). */
const FIRST = [
  'Ethan',
  'Maunika',
  'Zoë',
  'Nigella',
  'José',
  'Łukasz',
  'Yotam',
  'Sarah',
  'Kenji',
  'Anjum',
  'Samin',
  'Julia',
  'Marcella',
  'Jamie',
  'Ina',
  'Rick',
  'Nadiya',
  'Madhur',
  'Hugh',
  'Claire',
] as const;
const LAST = [
  'Chlebowski',
  'Gowardhan',
  'Jõgi',
  'Lawson',
  'Andrés',
  'Wójcik',
  'Ottolenghi',
  'Şahin',
  'López-Alt',
  'Anand',
  'Nosrat',
  'Child',
  'Hazan',
  'Oliver',
  'Garten',
  'Stein',
  'Hussain',
  'Jaffrey',
  'Fearnley-Whittingstall',
  'Saffitz',
] as const;
const PEOPLE = FIRST.flatMap((first) => LAST.map((last) => `${first} ${last}`));

describe('handwritingFor', () => {
  it('gives the same name the same face every time', () => {
    expect(handwritingFor('Ethan Chlebowski')).toBe(
      handwritingFor('Ethan Chlebowski'),
    );
  });

  it('ignores case and spacing, so one person is one face', () => {
    const face = handwritingFor('Ethan Chlebowski');
    expect(handwritingFor('ethan chlebowski')).toBe(face);
    expect(handwritingFor('Ethan  Chlebowski')).toBe(face);
    expect(handwritingFor('  ETHAN\tCHLEBOWSKI\n')).toBe(face);
    expect(handwritingFor('Ethan Chlebowski')).toBe(face);
  });

  it('treats a composed and a decomposed accent as the same letter', () => {
    expect(handwritingFor('Zoë Jõgi')).toBe(handwritingFor('Zoë Jõgi'));
  });

  it('only ever answers with one of the seven faces', () => {
    expect(
      PEOPLE.every((person) =>
        [0, 1, 2, 3, 4, 5, 6].includes(handwritingFor(person)),
      ),
    ).toBe(true);
  });

  it('spreads real-looking names across all seven faces, none starved', () => {
    const counts = Map.groupBy(PEOPLE, (person) => handwritingFor(person));
    expect(counts.size).toBe(7);
    // 400 names over 7 faces is 57 each; none should fall to half of that.
    expect([...counts.values()].every((people) => people.length > 28)).toBe(
      true,
    );
  });

  it('copes with an empty, blank or odd input, and always with the same face', () => {
    const odd = [
      '',
      '   ',
      '\n',
      '🙂',
      'A'.repeat(10_000),
      '<script>',
      '\u0000',
    ];
    expect(
      odd.every((value) =>
        [0, 1, 2, 3, 4, 5, 6].includes(handwritingFor(value)),
      ),
    ).toBe(true);
    expect(handwritingFor('')).toBe(handwritingFor('   '));
  });
});

describe('AuthorName', () => {
  it('draws the name as text', () => {
    expect(html(<AuthorName name="Ethan Chlebowski" />)).toMatch(
      />Ethan Chlebowski<\/span>$/,
    );
  });

  it('sets it in the face chosen for that name', () => {
    const out = html(<AuthorName name="Ethan Chlebowski" />);
    const face = [
      'caveat',
      'kalam',
      'shadows',
      'rainbow',
      'indie',
      'handrawn',
      'aurore',
    ][handwritingFor('Ethan Chlebowski')];
    expect(out).toContain(`font-hand-${face}`);
    expect(out.match(/font-hand-/g)).toHaveLength(1);
  });

  it('uses every one of the seven faces for some name', () => {
    const used = new Set(
      PEOPLE.map(
        (person) =>
          /font-hand-(\w+)/.exec(html(<AuthorName name={person} />))?.[1],
      ),
    );
    expect(used.size).toBe(7);
  });

  it('only raises the weight of the variable face', () => {
    const outs = PEOPLE.map((person) => html(<AuthorName name={person} />));
    expect(
      outs.every(
        (out) =>
          out.includes('font-semibold') === out.includes('font-hand-caveat'),
      ),
    ).toBe(true);
  });

  it('cuts a long name with an ellipsis, says it in full, and cannot overflow', () => {
    const long = 'A'.repeat(200);
    const out = html(<AuthorName name={long} />);
    expect(out).toContain(`title="${long}"`);
    expect(out).toMatch(/class="[^"]*\btruncate\b[^"]*"/);
    expect(out).toContain('max-w-full');
    expect(out).toContain('min-w-0');
  });

  it('is larger at the large size', () => {
    expect(html(<AuthorName name="Ada" size="md" />)).toContain('leading-7');
    expect(html(<AuthorName name="Ada" size="lg" />)).toContain('leading-8');
  });

  it('renders as the element asked for', () => {
    expect(html(<AuthorName name="Ada" as="p" />)).toMatch(/^<p /);
    expect(html(<AuthorName name="Ada" />)).toMatch(/^<span /);
  });

  it('never turns a hostile name into markup', () => {
    const out = html(<AuthorName name={'<img src=x onerror=alert(1)>"'} />);
    expect(out).not.toContain('<img');
    expect(out).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });
});
