import { describe, expect, it } from '@jest/globals';

import {
  StepTimersContext,
  useOptionalStepTimers,
  useStepTimers,
  type StepTimers,
} from '@/components/recipe/use-step-timers';
import { html } from '../render';

/** Renders what the hook returns, as JSON. */
function Probe(): React.ReactElement {
  const timers = useOptionalStepTimers();
  return <p>{timers === null ? 'none' : `timers:${timers.timers.length}`}</p>;
}

/** Renders the state a fresh set of timers starts in. */
function Fresh(): React.ReactElement {
  const timers = useStepTimers('Dal');
  return (
    <p>
      {timers.timers.length}|{timers.announcement}|{typeof timers.toggle}
    </p>
  );
}

describe('useOptionalStepTimers', () => {
  it('is null outside cook mode, where steps have no working timers', () => {
    expect(html(<Probe />)).toBe('<p>none</p>');
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
        <StepTimersContext.Provider value={value}>
          <Probe />
        </StepTimersContext.Provider>,
      ),
    ).toBe('<p>timers:0</p>');
  });
});

describe('useStepTimers', () => {
  it('starts with no timers and nothing announced', () => {
    expect(html(<Fresh />)).toBe('<p>0||function</p>');
  });
});
