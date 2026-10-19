import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import {
  afterDelay,
  HOVER_INTENT_MS,
  IntentLink,
} from '../../../src/components/ui/intent-link';
import { html } from '../render';

describe('IntentLink', () => {
  it('is an ordinary link to its address', () => {
    const out = html(<IntentLink href="/app">Recipes</IntentLink>);
    expect(out).toMatch(/^<a href="\/app"[^>]*>Recipes<\/a>$/);
  });

  it('passes the caller’s attributes on to the link', () => {
    const out = html(
      <IntentLink href="/app" aria-current="page" className="x">
        Recipes
      </IntentLink>,
    );
    expect(out).toContain('aria-current="page"');
    expect(out).toContain('class="x"');
  });

  it('can be switched off for links that go nowhere real', () => {
    expect(html(<IntentLink href="/demo" enabled={false} />)).toContain(
      'href="/demo"',
    );
  });

  it('can fetch its page at once', () => {
    expect(html(<IntentLink href="/app" eager />)).toContain('href="/app"');
  });
});

describe('afterDelay', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('runs once the delay is up', () => {
    const onIntent = jest.fn();
    afterDelay(onIntent, HOVER_INTENT_MS);
    jest.advanceTimersByTime(HOVER_INTENT_MS - 1);
    expect(onIntent).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(onIntent).toHaveBeenCalledTimes(1);
  });

  it('never runs if the pointer leaves first, so a sweep across a grid fetches nothing', () => {
    const onIntent = jest.fn();
    const cancel = afterDelay(onIntent, HOVER_INTENT_MS);
    jest.advanceTimersByTime(HOVER_INTENT_MS / 2);
    cancel();
    jest.runAllTimers();
    expect(onIntent).not.toHaveBeenCalled();
  });
});

describe('HOVER_INTENT_MS', () => {
  it('is long enough to skip a sweep and short enough to beat a click', () => {
    expect(HOVER_INTENT_MS).toBeGreaterThanOrEqual(80);
    expect(HOVER_INTENT_MS).toBeLessThanOrEqual(250);
  });
});
