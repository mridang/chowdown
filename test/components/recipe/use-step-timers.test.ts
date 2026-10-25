import { describe, expect, it } from '@jest/globals';
import { createElement, type ReactElement } from 'react';

import {
  StepTimersContext,
  useOptionalStepTimers,
  useStepTimers,
  type StepTimers,
} from '@/components/recipe/use-step-timers';
import { html } from '../render';

/** Renders what the hook returns, as JSON. */
function Probe(): ReactElement {
  const timers = useOptionalStepTimers();
  return createElement(
    'p',
    null,
    timers === null ? 'none' : `timers:${timers.timers.length}`,
  );
}

/** Renders the state a fresh set of timers starts in. */
function Fresh(): ReactElement {
  const timers = useStepTimers('Dal');
  return createElement(
    'p',
    null,
    timers.timers.length,
    '|',
    timers.announcement,
    '|',
    typeof timers.toggle,
  );
}

describe('useOptionalStepTimers', () => {
  it('is null outside cook mode, where steps have no working timers', () => {
    expect(html(createElement(Probe))).toBe('<p>none</p>');
  });

  it('is what cook mode supplies inside it', () => {
    const nothing = () => undefined;
    const value: StepTimers = {
      timers: [],
      now: 0,
      toggle: nothing,
      pause: nothing,
      resume: nothing,
      restart: nothing,
      addMinute: nothing,
      dismiss: nothing,
      clear: nothing,
      announcement: '',
    };
    expect(
      html(
        createElement(
          StepTimersContext.Provider,
          { value },
          createElement(Probe),
        ),
      ),
    ).toBe('<p>timers:0</p>');
  });
});

describe('useStepTimers', () => {
  it('starts with no timers and nothing announced', () => {
    expect(html(createElement(Fresh))).toBe('<p>0||function</p>');
  });
});
