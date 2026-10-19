import { describe, expect, it, jest } from '@jest/globals';

import {
  clampStep,
  CookMode,
  keepScreenAwake,
  stepOffsetForKey,
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
