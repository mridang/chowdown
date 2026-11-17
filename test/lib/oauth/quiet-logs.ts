import { afterEach, beforeEach, jest } from '@jest/globals';

/** A spy on a `console` method, as the helper below hands it out. */
export type LogSpy = jest.SpiedFunction<typeof console.info>;

/**
 * Keep the OAuth server's security-event lines (`console.info` and
 * `console.warn`) out of a suite's output. Call it once at the top of a test
 * file; the lines are still recorded on the returned spies for tests that want
 * to look at them.
 */
export function quietSecurityLogs() {
  const spies = new Map<'info' | 'warn', LogSpy>();
  beforeEach(() => {
    spies.set(
      'info',
      jest.spyOn(console, 'info').mockImplementation(() => {}),
    );
    spies.set(
      'warn',
      jest.spyOn(console, 'warn').mockImplementation(() => {}),
    );
  });
  afterEach(() => {
    spies.get('info')?.mockRestore();
    spies.get('warn')?.mockRestore();
  });
  return {
    info: () => spies.get('info')!,
    warn: () => spies.get('warn')!,
  };
}
