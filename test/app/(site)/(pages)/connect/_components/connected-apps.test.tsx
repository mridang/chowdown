import { describe, expect, it } from '@jest/globals';

import {
  ConnectedAppItem,
  ConnectedApps,
} from '@/app/(site)/(pages)/connect/_components/connected-apps';
import type { ConnectedApp } from '@/lib/connected-apps';
import { html } from '../../../../../components/render';

const APP: ConnectedApp = {
  id: 'g1',
  name: 'Claude',
  scopes: ['recipes:read'],
  installs: 1,
  connected_at: '2026-01-01T00:00:00.000Z',
};

/** The list item for an app, with the buttons doing nothing. */
const item = (app: ConnectedApp, busy = false) =>
  html(<ConnectedAppItem app={app} busy={busy} onDisconnect={() => {}} />);

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

describe('ConnectedAppItem', () => {
  it('says how much the app may do and that it has not been verified', () => {
    const out = item(APP);
    expect(out).toContain('Claude');
    expect(out).toContain('Read only');
    expect(out).toContain('unverified');
    expect(out).not.toContain('installs');
  });

  it('shows the widest access and the number of installs: "Can edit (2 installs)"', () => {
    const out = item({
      ...APP,
      scopes: ['recipes:read', 'recipes:write'],
      installs: 2,
    });
    expect(out).toContain('Can edit (2 installs)');
    expect(out).not.toContain('Read only');
  });

  it('shows the domain that published the app, so two apps with one name can be told apart', () => {
    const out = item({ ...APP, domain: 'claude.ai' });
    expect(out).toContain('claude.ai');
    expect(out).not.toContain('unverified');
  });

  it('says when the app was last used, if it was', () => {
    expect(item(APP)).not.toContain('last used');
    expect(
      item({ ...APP, last_used_at: '2026-01-02T00:00:00.000Z' }),
    ).toContain('last used');
  });

  it('has a Disconnect button named after the app, disabled while it works', () => {
    expect(item(APP)).toContain('aria-label="Disconnect Claude"');
    expect(item(APP)).not.toMatch(/\sdisabled(=|\s|>)/);
    const busy = item(APP, true);
    expect(busy).toContain('disabled');
    expect(busy).toContain('Disconnecting…');
  });

  it('only ever renders the name as text', () => {
    const out = item({ ...APP, name: '<img src=x onerror=alert(1)>' });
    expect(out).not.toContain('<img');
    expect(out).toContain('&lt;img');
  });
});
