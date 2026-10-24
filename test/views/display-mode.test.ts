import { describe, expect, it } from '@jest/globals';

import {
  INITIAL_LAYOUT,
  SUPPORTED_DISPLAY_MODES,
  hostOffersMode,
  isDisplayMode,
  isExpanded,
  modeFromResult,
  planExpand,
  reduceLayout,
  type LayoutState,
} from '@/views/display-mode';

describe('display modes a View declares', () => {
  it('declares inline and fullscreen, the two layouts the Views implement', () => {
    expect([...SUPPORTED_DISPLAY_MODES]).toEqual(['inline', 'fullscreen']);
  });

  it('recognises the three modes of the spec and nothing else', () => {
    expect(['inline', 'fullscreen', 'pip'].every(isDisplayMode)).toBe(true);
    expect(isDisplayMode('window')).toBe(false);
    expect(isDisplayMode(undefined)).toBe(false);
    expect(isDisplayMode(3)).toBe(false);
  });
});

describe('hostOffersMode', () => {
  it('believes a host that lists its modes', () => {
    const context = { availableDisplayModes: ['inline'] };
    expect(hostOffersMode(context, 'fullscreen')).toBe(false);
    expect(hostOffersMode(context, 'inline')).toBe(true);
  });

  it('gives a host that lists nothing the benefit of the doubt', () => {
    expect(hostOffersMode({}, 'fullscreen')).toBe(true);
    expect(hostOffersMode(undefined, 'fullscreen')).toBe(true);
  });
});

describe('planExpand', () => {
  it('asks the host for fullscreen when it offers it', () => {
    expect(
      planExpand({ availableDisplayModes: ['inline', 'fullscreen'] }),
    ).toBe('request');
    expect(planExpand(undefined)).toBe('request');
  });

  it('expands in place when the host has no fullscreen', () => {
    expect(planExpand({ availableDisplayModes: ['inline'] })).toBe('local');
    expect(planExpand({ availableDisplayModes: [] })).toBe('local');
  });
});

describe('reduceLayout', () => {
  const fullscreen: LayoutState = {
    hostMode: 'fullscreen',
    expandedLocally: false,
    collapseRefused: false,
  };

  it('starts inline and collapsed', () => {
    expect(isExpanded(INITIAL_LAYOUT)).toBe(false);
  });

  it('expands when the host goes fullscreen', () => {
    const next = reduceLayout(INITIAL_LAYOUT, {
      type: 'host-mode',
      mode: 'fullscreen',
    });
    expect(isExpanded(next)).toBe(true);
  });

  it('collapses when the host leaves fullscreen, so the card is never stuck', () => {
    const next = reduceLayout(fullscreen, {
      type: 'host-mode',
      mode: 'inline',
    });
    expect(next).toEqual({
      hostMode: 'inline',
      expandedLocally: false,
      collapseRefused: false,
    });
    expect(isExpanded(next)).toBe(false);
  });

  it('drops an in-place expansion when the host leaves fullscreen', () => {
    const next = reduceLayout(
      { ...fullscreen, expandedLocally: true },
      { type: 'host-mode', mode: 'inline' },
    );
    expect(isExpanded(next)).toBe(false);
  });

  it('keeps an in-place expansion when the host merely repeats inline', () => {
    const expanded = reduceLayout(INITIAL_LAYOUT, { type: 'expand-locally' });
    const next = reduceLayout(expanded, { type: 'host-mode', mode: 'inline' });
    expect(isExpanded(next)).toBe(true);
  });

  it('expands and collapses in place', () => {
    const expanded = reduceLayout(INITIAL_LAYOUT, { type: 'expand-locally' });
    expect(isExpanded(expanded)).toBe(true);
    expect(
      isExpanded(reduceLayout(expanded, { type: 'collapse-locally' })),
    ).toBe(false);
  });
});

describe('modeFromResult', () => {
  it('reads the mode the host actually set', () => {
    expect(modeFromResult({ mode: 'inline' })).toBe('inline');
    expect(modeFromResult({ mode: 'fullscreen', extra: 1 })).toBe('fullscreen');
  });

  it('refuses answers it cannot read', () => {
    expect(modeFromResult({ mode: 'sideways' })).toBeUndefined();
    expect(modeFromResult({})).toBeUndefined();
    expect(modeFromResult(null)).toBeUndefined();
    expect(modeFromResult('fullscreen')).toBeUndefined();
  });
});

describe('a host that will not leave fullscreen', () => {
  const refused = reduceLayout(
    { hostMode: 'fullscreen', expandedLocally: false, collapseRefused: false },
    { type: 'collapse-refused' },
  );

  it('stays expanded and remembers that the way out is the host’s', () => {
    expect(isExpanded(refused)).toBe(true);
    expect(refused.collapseRefused).toBe(true);
  });

  it('forgets the refusal when the host reports a mode or the View tries again', () => {
    expect(
      reduceLayout(refused, { type: 'host-mode', mode: 'inline' })
        .collapseRefused,
    ).toBe(false);
    expect(
      reduceLayout(refused, { type: 'collapse-locally' }).collapseRefused,
    ).toBe(false);
  });
});

describe('hostOffersMode without a list', () => {
  it('lets a View ask, because the host may leave the field out and will answer with what it did set', () => {
    expect(hostOffersMode({}, 'fullscreen')).toBe(true);
    expect(hostOffersMode(undefined, 'fullscreen')).toBe(true);
    expect(hostOffersMode({ availableDisplayModes: [] }, 'fullscreen')).toBe(
      false,
    );
  });
});
