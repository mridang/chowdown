import { describe, expect, it, jest } from '@jest/globals';

import {
  clampStep,
  CookMode,
  keepScreenAwake,
  StepBody,
  stepOffsetForEvent,
  stepOffsetForKey,
  usesArrowKeys,
} from '../../../src/components/recipe/cook-mode';
import { RecipeStateProvider } from '../../../src/components/recipe/recipe-state';
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

describe('keepScreenAwake', () => {
  it('asks for a screen lock and gives it back when released', async () => {
    const release = jest.fn(async () => undefined);
    const request = jest
      .fn<(type: 'screen') => Promise<{ release: typeof release }>>()
      .mockResolvedValue({ release });
    const stop = keepScreenAwake({ request } as never);
    expect(request).toHaveBeenCalledWith('screen');
    stop();
    await Promise.resolve();
    await Promise.resolve();
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('gives the lock straight back if it is released before it was granted', async () => {
    const release = jest.fn(async () => undefined);
    const request = jest.fn(
      () =>
        new Promise<{ release: () => Promise<void> }>((grant) => {
          setTimeout(() => grant({ release }), 0);
        }),
    );
    const stop = keepScreenAwake({ request } as never);
    stop();
    expect(release).not.toHaveBeenCalled();
    await new Promise((done) => setTimeout(done, 5));
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('does nothing, without error, when the browser refuses', async () => {
    const request = jest.fn(async () => {
      throw new Error('denied');
    });
    const stop = keepScreenAwake({ request } as never);
    expect(() => stop()).not.toThrow();
    await new Promise((done) => setTimeout(done, 0));
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

describe('StepBody', () => {
  const body = htmlAt(
    <RecipeStateProvider servings={4} initialUnits="original">
      <StepBody
        tokens={[
          { kind: 'text', text: 'Fry ' },
          { kind: 'ingredient', name: 'onion', quantity: '2' },
          { kind: 'text', text: ' in a ' },
          { kind: 'cookware', name: 'pan' },
          { kind: 'text', text: ' for ' },
          { kind: 'timer', label: '5 minutes' },
        ]}
      />
    </RecipeStateProvider>,
  );

  it('underlines ingredients and shows the amount for the servings chosen', () => {
    expect(body).toMatch(/<span class="[^"]*underline[^"]*">onion<\/span>/);
    expect(body).toContain('(2)');
  });

  it('colours cookware, and gives a timer a clock', () => {
    expect(body).toMatch(/<span class="text-forest">pan<\/span>/);
    expect(body).toMatch(/<svg[^>]*>.*<\/svg>5 minutes/s);
  });

  it('leaves out the amount of an ingredient that has none', () => {
    const out = htmlAt(
      <RecipeStateProvider servings={4} initialUnits="original">
        <StepBody
          tokens={[{ kind: 'ingredient', name: 'salt', quantity: '' }]}
        />
      </RecipeStateProvider>,
    );
    expect(out).toContain('salt');
    expect(out).not.toContain('(');
  });
});
