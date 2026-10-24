import { describe, expect, it } from '@jest/globals';

import { WorksWith } from '@/components/landing/works-with';
import { html } from '../render';

describe('WorksWith', () => {
  it('names what chowdown works with', () => {
    const out = html(<WorksWith />);
    expect(out).toContain('Google Drive');
    expect(out).toContain('ChatGPT');
    expect(out).toContain('Claude');
  });
});
