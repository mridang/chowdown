import { describe, expect, it } from '@jest/globals';

import { ServiceWorker } from '../../../src/components/site/service-worker';
import { html } from '../render';

describe('ServiceWorker', () => {
  it('draws nothing: it only registers the worker once the page has loaded', () => {
    expect(html(<ServiceWorker />)).toBe('');
  });
});
