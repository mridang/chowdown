import { describe, expect, it } from '@jest/globals';

import {
  clampStep,
  CookMode,
  stepOffsetForEvent,
  stepOffsetForKey,
  usesArrowKeys,
} from '@/components/recipe/cook-mode';
import { RecipeStateProvider } from '@/components/recipe/recipe-state';
import { htmlAt } from '../render';

const STEPS = [
  [{ kind: 'text' as const, text: 'Chop.' }],
  [{ kind: 'text' as const, text: 'Fry.' }],
];

describe('CookMode', () => {
  const out = htmlAt(
    <RecipeStateProvider servings={4} initialUnits="original">
      <CookMode title="Dal" steps={STEPS} />
    </RecipeStateProvider>,
  );

  it('offers a "Cook mode" button', () => {
    expect(out).toMatch(/<button[^>]*>.*Cook mode<\/button>/s);
  });

  it('keeps the full-screen view closed until it is asked for', () => {
    expect(out).toContain('<dialog');
    expect(out).not.toContain('Step 1 of 2');
    expect(out).not.toContain('Chop.');
    expect(out).not.toContain('role="progressbar"');
  });
});

describe('clampStep', () => {
  it('keeps a step that exists', () => {
    expect(clampStep(1, 3)).toBe(1);
  });

  it('stops at the first step going back', () => {
    expect(clampStep(-1, 3)).toBe(0);
  });

  it('stops at the last step going on', () => {
    expect(clampStep(3, 3)).toBe(2);
  });
});

describe('stepOffsetForKey', () => {
  it('moves on for the right arrow and back for the left', () => {
    expect(stepOffsetForKey('ArrowRight')).toBe(1);
    expect(stepOffsetForKey('ArrowLeft')).toBe(-1);
  });

  it('ignores every other key', () => {
    expect(stepOffsetForKey('Enter')).toBe(0);
    expect(stepOffsetForKey('ArrowUp')).toBe(0);
  });
});

/** An event target with the given extra members, as a form control or the page would be. */
const target = (members: object): EventTarget =>
  Object.assign(new EventTarget(), members);

describe('usesArrowKeys', () => {
  it('is true for text boxes, lists and rich text, where arrows belong to the control', () => {
    expect(usesArrowKeys(target({ tagName: 'INPUT' }))).toBe(true);
    expect(usesArrowKeys(target({ tagName: 'textarea' }))).toBe(true);
    expect(usesArrowKeys(target({ tagName: 'SELECT' }))).toBe(true);
    expect(
      usesArrowKeys(target({ tagName: 'DIV', isContentEditable: true })),
    ).toBe(true);
  });

  it('is false for buttons, the page and a missing target', () => {
    expect(usesArrowKeys(target({ tagName: 'BUTTON' }))).toBe(false);
    expect(usesArrowKeys(target({ tagName: 'BODY' }))).toBe(false);
    expect(usesArrowKeys(null)).toBe(false);
  });
});

describe('stepOffsetForEvent', () => {
  const press = (
    key: string,
    extra: Partial<Parameters<typeof stepOffsetForEvent>[0]> = {},
  ) => ({
    key,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    defaultPrevented: false,
    target: target({ tagName: 'BODY' }),
    ...extra,
  });

  it('moves through the steps for a plain arrow key', () => {
    expect(stepOffsetForEvent(press('ArrowRight'))).toBe(1);
    expect(stepOffsetForEvent(press('ArrowLeft'))).toBe(-1);
  });

  it('leaves the arrows to a control that uses them', () => {
    expect(
      stepOffsetForEvent(
        press('ArrowLeft', { target: target({ tagName: 'INPUT' }) }),
      ),
    ).toBe(0);
  });

  it('leaves Alt+Left (the browser’s Back) and other shortcuts alone', () => {
    expect(stepOffsetForEvent(press('ArrowLeft', { altKey: true }))).toBe(0);
    expect(stepOffsetForEvent(press('ArrowRight', { metaKey: true }))).toBe(0);
    expect(stepOffsetForEvent(press('ArrowRight', { ctrlKey: true }))).toBe(0);
    expect(stepOffsetForEvent(press('ArrowRight', { shiftKey: true }))).toBe(0);
  });

  it('leaves a key press something else already handled', () => {
    expect(
      stepOffsetForEvent(press('ArrowRight', { defaultPrevented: true })),
    ).toBe(0);
  });

  it('ignores every other key', () => {
    expect(stepOffsetForEvent(press('Enter'))).toBe(0);
  });
});
