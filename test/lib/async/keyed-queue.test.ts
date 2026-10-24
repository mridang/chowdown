import { describe, expect, it } from '@jest/globals';

import { createKeyedQueue } from '@/lib/async/keyed-queue';

/** Let queued microtasks run, so a job that is ready to start has started. */
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** A promise that can be settled from outside, to hold a job open. */
function gate() {
  const handle: { open: () => void } = { open: () => undefined };
  const opened = new Promise<void>((resolve) => {
    handle.open = resolve;
  });
  return { opened, open: () => handle.open() };
}

describe('createKeyedQueue', () => {
  it('runs the jobs of one key in order, one at a time', async () => {
    const queue = createKeyedQueue();
    const log: string[] = [];
    const first = gate();
    const a = queue.run('k', async () => {
      log.push('a start');
      await first.opened;
      log.push('a end');
    });
    await tick();
    const b = queue.run('k', async () => {
      log.push('b');
    });
    expect(log).toEqual(['a start']);
    first.open();
    await Promise.all([a, b]);
    expect(log).toEqual(['a start', 'a end', 'b']);
  });

  it('runs different keys at the same time', async () => {
    const queue = createKeyedQueue();
    const hold = gate();
    const log: string[] = [];
    const a = queue.run('a', async () => {
      await hold.opened;
      log.push('a');
    });
    await queue.run('b', async () => {
      log.push('b');
    });
    expect(log).toEqual(['b']);
    hold.open();
    await a;
  });

  it('answers a second request for a waiting key with the job already waiting', async () => {
    const queue = createKeyedQueue();
    const first = gate();
    const ran: string[] = [];
    const a = queue.run('k', async () => {
      ran.push('a');
      await first.opened;
    });
    await tick();
    const b = queue.run('k', async () => {
      ran.push('b');
    });
    const c = queue.run('k', async () => {
      ran.push('c');
    });
    expect(c).toBe(b);
    first.open();
    await Promise.all([a, b, c]);
    expect(ran).toEqual(['a', 'b']);
  });

  it('queues a fresh job once the waiting one has started', async () => {
    const queue = createKeyedQueue();
    const ran: string[] = [];
    await queue.run('k', async () => {
      ran.push('a');
    });
    await queue.run('k', async () => {
      ran.push('b');
    });
    expect(ran).toEqual(['a', 'b']);
  });

  it('runs the next job even when the one before it failed', async () => {
    const queue = createKeyedQueue();
    const hold = gate();
    const ran: string[] = [];
    const failed = queue.run('k', async () => {
      await hold.opened;
      throw new Error('boom');
    });
    await tick();
    const after = queue.run('k', async () => {
      ran.push('after');
    });
    hold.open();
    await expect(failed).rejects.toThrow('boom');
    await after;
    expect(ran).toEqual(['after']);
  });
});
