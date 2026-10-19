import { describe, expect, it } from '@jest/globals';

import {
  HEADER_ROW_CLASS,
  HEADER_ROW_REM,
  MAIN_MIN_HEIGHT_CLASS,
  STICKY_PANEL_CLASS,
  STICKY_SIDEBAR_CLASS,
} from '../../../src/components/site/header-height';

/** The first number (in rem) found after `prefix` in a class string. */
function remAfter(classes: string, prefix: RegExp): number {
  const match = prefix.exec(classes);
  if (!match?.[1]) {
    throw new Error(`no rem value matching ${prefix} in ${classes}`);
  }
  return Number(match[1]);
}

// The marigold strip above the header row, and the 1px rule below it.
const STRIP_REM = 0.375;
const RULE_REM = 1 / 16;

describe('header height', () => {
  it('spells the row height in the class the numeric constant promises', () => {
    expect(HEADER_ROW_CLASS).toBe(`h-[${HEADER_ROW_REM}rem]`);
  });

  it('keeps the content area just clear of the whole header', () => {
    const offset = remAfter(MAIN_MIN_HEIGHT_CLASS, /100svh-([\d.]+)rem/);
    const header = STRIP_REM + HEADER_ROW_REM + RULE_REM;
    // The offset is the header's height, rounded up to the next quarter rem.
    expect(offset).toBeGreaterThanOrEqual(header);
    expect(offset - header).toBeLessThan(0.25);
    expect(offset).toBe(HEADER_ROW_REM + 0.5);
  });

  it('pins a sidebar below the header and caps it to the screen beneath', () => {
    const top = remAfter(STICKY_SIDEBAR_CLASS, /md:top-(\d+)/) / 4;
    const cap = remAfter(STICKY_SIDEBAR_CLASS, /100vh-([\d.]+)rem/);
    expect(top).toBeGreaterThan(STRIP_REM + HEADER_ROW_REM + RULE_REM);
    // The cap leaves the same gap below the sidebar as above it.
    expect(cap - top).toBe(1);
  });

  it('pins the recipe page’s panel a little lower than a sidebar, with the same gaps', () => {
    const top = remAfter(STICKY_PANEL_CLASS, /md:top-(\d+)/) / 4;
    const cap = remAfter(STICKY_PANEL_CLASS, /100vh-([\d.]+)rem/);
    expect(top).toBeGreaterThan(
      remAfter(STICKY_SIDEBAR_CLASS, /md:top-(\d+)/) / 4,
    );
    expect(cap - top).toBe(1);
  });
});
