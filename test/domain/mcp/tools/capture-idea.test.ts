import { describe, expect, it } from '@jest/globals';

import { call, folder, said } from '../../../lib/mcp/tool-fakes';

describe('capture_idea', () => {
  it('saves an uncurated stub with the request kept verbatim, and caches it', async () => {
    const fake = folder();
    const result = await call(
      'capture_idea',
      { name: 'paneer ki sabji', prompt: 'make paneer ki sabji' },
      fake,
    );
    expect(said(result)).toContain(
      'Saved "paneer ki sabji" as an idea to curate later.',
    );
    expect(fake.created).toHaveLength(1);
    const stored = fake.indexed[0];
    expect(stored?.[0]).toBe(fake.created[0]?.id);
    expect(stored?.[2]).toContain('make paneer ki sabji');
  });

  it('keeps one file when the same call is repeated, and says so', async () => {
    const fake = folder();
    const args = { name: 'paneer ki sabji', prompt: 'make paneer ki sabji' };
    await call('capture_idea', args, fake);
    const again = await call('capture_idea', args, fake);
    expect(fake.created).toHaveLength(1);
    expect(said(again)).toContain('is already saved with this recipe');
    expect(again.isError).toBeUndefined();
    expect(again.structuredContent).toMatchObject({
      id: 'id-paneer ki sabji [uncurated].cook',
    });
  });

  it('saves a second idea of the same name when what was asked for differs, and mentions the first', async () => {
    const fake = folder();
    await call('capture_idea', { name: 'soup', prompt: 'a quick soup' }, fake);
    const other = await call(
      'capture_idea',
      { name: 'soup', prompt: 'a slow soup' },
      fake,
    );
    expect(fake.created).toHaveLength(2);
    expect(said(other)).toContain(
      'A different recipe with the same name already exists',
    );
  });

  it('refuses a request that is only spaces, writing nothing', async () => {
    const fake = folder();
    const result = await call(
      'capture_idea',
      { name: 'soup', prompt: ' '.repeat(3) },
      fake,
    );
    expect(result.isError).toBe(true);
    expect(said(result)).toContain('`prompt` must not be blank');
    expect(fake.created).toEqual([]);
  });
});
