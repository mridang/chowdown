import { describe, expect, it } from '@jest/globals';

import { Segmented } from '@/components/ui/segmented';
import { html } from '../render';

const VALUE_US_CHECKED = /value="us"[^>]*checked=""|checked=""[^>]*value="us"/;
const LABEL_US_SPAN = /<label[^>]*>.*US<\/span><\/label>/;
const LABEL_METRIC_SPAN = /<label[^>]*>.*Metric<\/span><\/label>/;

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
    expect(out).toMatch(LABEL_METRIC_SPAN);
    expect(out).toMatch(LABEL_US_SPAN);
  });

  it('checks only the selected option', () => {
    expect(out.match(/checked=""/g)).toHaveLength(1);
    expect(out).toMatch(VALUE_US_CHECKED);
  });

  it('groups the radios under one name, so arrow keys move between them', () => {
    const names = Array.from(out.matchAll(/name="([^"]+)"/g), (m) => m[1]);
    expect(new Set(names).size).toBe(1);
  });
});
