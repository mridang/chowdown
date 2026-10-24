import { describe, expect, it } from '@jest/globals';

import {
  ClockIcon,
  DriveIcon,
  GoogleIcon,
  Html5Icon,
  HeartIcon,
  McpIcon,
  PlayIcon,
  ProteinIcon,
  SparklesIcon,
} from '@/components/icons';
import { classOf, html } from './render';

describe('icons', () => {
  it('follow the text around them unless given a size', () => {
    const out = html(<ClockIcon />);
    expect(out).toContain('width="1em"');
    expect(out).not.toContain('class=');
  });

  it('take a standard size instead of hand-written classes', () => {
    expect(classOf(html(<ClockIcon size="sm" />), 'svg')).toBe('h-4 w-4');
    expect(classOf(html(<ClockIcon size="md" />), 'svg')).toBe('h-5 w-5');
    expect(classOf(html(<ClockIcon size="lg" />), 'svg')).toBe('h-6 w-6');
    expect(classOf(html(<ClockIcon size="xs" />), 'svg')).toBe('h-3 w-3');
    expect(classOf(html(<ClockIcon size="menu" />), 'svg')).toBe(
      'h-[18px] w-[18px]',
    );
  });

  it('add any further classes after the size', () => {
    expect(
      classOf(html(<ClockIcon size="sm" className="text-subtle" />), 'svg'),
    ).toBe('h-4 w-4 text-subtle');
  });

  it('are hidden from assistive technology, and the Google one honours sizes too', () => {
    expect(html(<HeartIcon />)).toContain('aria-hidden="true"');
    expect(classOf(html(<GoogleIcon size="md" />), 'svg')).toBe('h-5 w-5');
  });

  it('has a filled play triangle that takes the same sizes', () => {
    const out = html(<PlayIcon size="sm" />);
    expect(classOf(out, 'svg')).toBe('h-4 w-4');
    expect(out).toContain('fill="currentColor"');
    expect(out).toContain('stroke="none"');
  });

  it('picks the protein icon, and a pan for anything it does not know', () => {
    expect(html(<ProteinIcon protein="Chicken" />)).toBe(
      html(<ProteinIcon protein="chicken" />),
    );
    expect(html(<ProteinIcon protein="dragon" />)).toContain('<svg');
  });

  it('does not mistake a name from JavaScript’s own objects for a protein', () => {
    for (const word of [
      'constructor',
      'toString',
      '__proto__',
      'hasOwnProperty',
    ]) {
      expect(html(<ProteinIcon protein={word} />)).toBe(
        html(<ProteinIcon protein="dragon" />),
      );
    }
  });

  it('draws Drive as Google’s logo in its own colours, sized like the others', () => {
    const out = html(<DriveIcon size="md" />);
    expect(classOf(out, 'svg')).toBe('h-5 w-5');
    expect(out).toContain('aria-hidden="true"');
    for (const colour of [
      '#0066da',
      '#00ac47',
      '#ea4335',
      '#00832d',
      '#2684fc',
      '#ffba00',
    ]) {
      expect(out).toContain(`fill="${colour}"`);
    }
    expect(out).not.toContain('currentColor');
  });

  it('draws MCP as its three blue loops, sized like the others', () => {
    const out = html(<McpIcon size="menu" />);
    expect(out).toContain('aria-hidden="true"');
    for (const colour of ['#0253cf', '#2783ff', '#3eadff']) {
      expect(out).toContain(`stroke="${colour}"`);
    }
    expect(out).not.toContain('currentColor');
  });

  it('draws the web app as the HTML5 shield in its own colours', () => {
    const out = html(<Html5Icon size="menu" />);
    expect(out).toContain('aria-hidden="true"');
    for (const colour of ['#e44d26', '#f16529', '#fff']) {
      expect(out).toContain(`fill="${colour}"`);
    }
    expect(out).not.toContain('currentColor');
  });

  it('draws the AI sparkles filled, in the text colour, hidden from assistive technology', () => {
    const out = html(<SparklesIcon size="sm" />);
    expect(classOf(out, 'svg')).toBe('h-4 w-4');
    expect(out).toContain('aria-hidden="true"');
    expect(out).toContain('fill="currentColor"');
  });
});
