import { describe, expect, it } from '@jest/globals';

import { Segmented } from '@/components/ui/segmented';
import { html } from '../render';

const OPTIONS = [
  { value: 'metric', label: 'Metric' },
  { value: 'us', label: 'US' },
] as const;

describe('Segmented', () => {
  const out = html(
    <Segmented
      label="Units"
      value="us"
      options={OPTIONS}
      onValueChange={() => undefined}
    />,
  );

  it('is a radio group named for what it chooses', () => {
    expect(out).toContain('role="radiogroup" aria-label="Units"');
  });

  it('has one radio button for each option, labelled', () => {
    expect(out.match(/type="radio"/g)).toHaveLength(2);
    expect(out).toMatch(/<label[^>]*>.*Metric<\/span><\/label>/);
    expect(out).toMatch(/<label[^>]*>.*US<\/span><\/label>/);
  });

  it('checks only the selected option', () => {
    expect(out.match(/checked=""/g)).toHaveLength(1);
    expect(out).toMatch(/value="us"[^>]*checked=""|checked=""[^>]*value="us"/);
  });

  it('groups the radios under one name, so arrow keys move between them', () => {
    const names = [...out.matchAll(/name="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(names).size).toBe(1);
  });
});
