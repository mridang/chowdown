import { describe, expect, it } from '@jest/globals';

import { TimerTray } from '@/components/recipe/timer-tray';
import type { StepTimer } from '@/components/recipe/timer-state';
import type { StepTimers } from '@/components/recipe/use-step-timers';
import { html } from '../render';

const MIN = 60_000;
const NOW = 5_000_000;

const nothing = () => undefined;

const timers = (list: readonly StepTimer[]): StepTimers => ({
  timers: list,
  now: NOW,
  toggle: nothing,
  pause: nothing,
  resume: nothing,
  restart: nothing,
  addMinute: nothing,
  dismiss: nothing,
  clear: nothing,
  announcement: '',
});

const timer = (
  id: string,
  step: number,
  phase: StepTimer['phase'],
): StepTimer => ({
  id,
  step,
  label: '5 minutes',
  durationMs: 5 * MIN,
  phase,
});

describe('TimerTray', () => {
  it('renders nothing when there are no timers', () => {
    expect(html(<TimerTray timers={timers([])} />)).toBe('');
  });

  it('is a labelled list with an entry per timer', () => {
    const out = html(
      <TimerTray
        timers={timers([
          timer('0:1', 0, { status: 'running', endsAt: NOW + MIN }),
          timer('2:0', 2, { status: 'running', endsAt: NOW + 2 * MIN }),
        ])}
      />,
    );
    expect(out).toContain('<ul aria-label="Timers"');
    expect(out.match(/<li /g)).toHaveLength(2);
    expect(out).toContain('Step 1');
    expect(out).toContain('Step 3');
  });

  it('shows the time left as a timer', () => {
    const out = html(
      <TimerTray
        timers={timers([
          timer('0:1', 0, { status: 'running', endsAt: NOW + 4 * MIN + 7000 }),
        ])}
      />,
    );
    expect(out).toMatch(
      /<p role="timer" aria-label="Step 1 timer"[^>]*>.*4:07/s,
    );
  });

  it('offers pause, add a minute and cancel for a running timer, each named for its step', () => {
    const out = html(
      <TimerTray
        timers={timers([
          timer('1:0', 1, { status: 'running', endsAt: NOW + MIN }),
        ])}
      />,
    );
    expect(out).toContain(
      'Pause<span class="sr-only"> timer for step 2</span>',
    );
    expect(out).toContain(
      '+1 min<span class="sr-only"> on the timer for step 2</span>',
    );
    expect(out).toContain(
      'Cancel<span class="sr-only"> timer for step 2</span>',
    );
  });

  it('offers resume for a paused timer', () => {
    const out = html(
      <TimerTray
        timers={timers([
          timer('0:1', 0, { status: 'paused', remainingMs: MIN }),
        ])}
      />,
    );
    expect(out).toContain('Resume<span');
    expect(out).toContain('1:00');
  });

  it('marks a finished timer with the word Done and a colour, and offers to restart or dismiss', () => {
    const out = html(
      <TimerTray timers={timers([timer('0:1', 0, { status: 'done' })])} />,
    );
    expect(out).toContain('Done');
    expect(out).toContain('border-flame');
    expect(out).toContain('Restart<span');
    expect(out).toContain('Dismiss<span');
  });

  it('has every control as a button at least 44px tall, and no animation', () => {
    const out = html(
      <TimerTray timers={timers([timer('0:1', 0, { status: 'done' })])} />,
    );
    const buttons = out.match(/<button[^>]*>/g) ?? [];
    expect(buttons).toHaveLength(3);
    buttons.forEach((button) => expect(button).toContain('min-h-11'));
    expect(out).not.toMatch(/animate-|blink|flash/);
  });
});
