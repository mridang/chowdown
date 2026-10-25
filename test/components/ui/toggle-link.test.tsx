import { describe, expect, it } from '@jest/globals';

import { ToggleLink } from '@/components/ui/toggle-link';
import { html } from '../render';

describe('ToggleLink', () => {
  it('is a real link to the page with the filter flipped', () => {
    const out = html(
      <ToggleLink href="/app?favourites=1" active={false}>
        Favourites
      </ToggleLink>,
    );
    expect(out).toContain('<a ');
    expect(out).toContain('href="/app?favourites=1"');
    expect(out).toContain('Favourites');
  });

  it('says it is the current choice while the filter is on', () => {
    const out = html(
      <ToggleLink href="/app" active>
        Favourites
      </ToggleLink>,
    );
    expect(out).toContain('aria-current="true"');
  });

  it('reads as a plain link while the filter is off', () => {
    const out = html(
      <ToggleLink href="/app" active={false}>
        Favourites
      </ToggleLink>,
    );
    expect(out).not.toContain('aria-current');
  });

  it('does not claim a role whose keyboard behaviour a link cannot give', () => {
    for (const active of [true, false]) {
      const out = html(
        <ToggleLink href="/app" active={active}>
          x
        </ToggleLink>,
      );
      expect(out).not.toContain('role=');
      expect(out).not.toContain('aria-checked');
      expect(out).not.toContain('aria-pressed');
    }
  });

  it('takes the look from the caller', () => {
    const out = html(
      <ToggleLink href="/app" active={false} className="h-10 bg-marigold">
        x
      </ToggleLink>,
    );
    expect(out).toContain('class="h-10 bg-marigold"');
  });

  it('tells screen readers what pressing it does, but only while it is on', () => {
    const on = html(
      <ToggleLink href="/app" active activeText="selected">
        Easy
      </ToggleLink>,
    );
    expect(on).toContain('sr-only');
    expect(on).toContain(', selected');
    const off = html(
      <ToggleLink href="/app" active={false} activeText="selected">
        Easy
      </ToggleLink>,
    );
    expect(off).not.toContain('selected');
  });
});
