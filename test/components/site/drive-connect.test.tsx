import { describe, expect, it } from '@jest/globals';

import {
  DriveConnectNotice,
  DriveConnectPanel,
  DriveUnreachable,
} from '@/components/site/drive-connect';
import { html } from '../render';

describe('DriveConnectPanel', () => {
  it('invites someone to connect, with a button that always asks again', () => {
    const out = html(<DriveConnectPanel returnTo="/recipes/add" />);
    expect(out).toContain('One more step');
    expect(out).toMatch(/<h2[^>]*>Connect your Google Drive<\/h2>/);
    expect(out).toContain('Connect Google Drive');
    expect(out).toContain('/auth/drive?returnTo=%2Frecipes%2Fadd&amp;force=1');
  });

  it('says reconnect for someone whose connection lapsed', () => {
    const out = html(<DriveConnectPanel reconnect />);
    expect(out).toContain('Connection lost');
    expect(out).toContain('Reconnect your Google Drive');
    expect(out).toContain('Reconnect Google Drive');
    expect(out).toContain('force=1');
  });

  it('is the page heading when it is the whole page', () => {
    expect(html(<DriveConnectPanel heading="h1" />)).toMatch(
      /<h1[^>]*>Connect/,
    );
  });

  it('explains a failed attempt in an announced note', () => {
    expect(html(<DriveConnectPanel />)).not.toContain(
      'permission was not granted',
    );
    const out = html(<DriveConnectPanel attempt="denied" />);
    expect(out).toContain('the permission was not granted');
  });
});

describe('DriveConnectNotice', () => {
  it('says Drive is missing and offers the fix', () => {
    const out = html(<DriveConnectNotice />);
    expect(out).toContain('Google Drive is not connected');
    expect(out).toContain('Recipes shown here are saved copies');
    expect(out).toContain('/auth/drive?force=1');
  });

  it('says disconnected after a lapse, and takes its own message', () => {
    const out = html(
      <DriveConnectNotice reconnect message="No recipes yet." />,
    );
    expect(out).toContain('Google Drive is disconnected');
    expect(out).toContain('No recipes yet.');
    expect(out).toContain('Reconnect Google Drive');
  });

  it('prefers the reason a failed attempt gave', () => {
    const out = html(<DriveConnectNotice attempt="error" />);
    expect(out).toContain('Something went wrong connecting Google Drive');
    expect(out).not.toContain('saved copies');
  });
});

describe('DriveUnreachable', () => {
  it('says Drive could not be reached, not that there are no recipes', () => {
    const out = html(<DriveUnreachable />);
    expect(out).toMatch(/<h2[^>]*>Couldn’t reach Google Drive<\/h2>/);
    expect(out).toContain('Your recipes are safe in your Drive');
    expect(out).not.toContain('No recipes');
  });
});
