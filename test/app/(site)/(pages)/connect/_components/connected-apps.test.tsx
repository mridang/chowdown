import { describe, expect, it } from '@jest/globals';

import { ConnectedApps } from '../../../../../../src/app/(site)/(pages)/connect/_components/connected-apps';
import { html } from '../../../../../components/render';

describe('ConnectedApps', () => {
  it('says it is loading until the list arrives, politely', () => {
    const out = html(<ConnectedApps />);
    expect(out).toMatch(/<p[^>]*role="status"[^>]*>Loading…<\/p>/);
  });

  it('does not show a list or an error before then', () => {
    const out = html(<ConnectedApps />);
    expect(out).not.toContain('<ul');
    expect(out).not.toContain('role="alert"');
    expect(out).not.toContain('Could not load');
  });
});
