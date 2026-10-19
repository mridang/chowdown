import { describe, expect, it } from '@jest/globals';

import { checkDriveGrant } from '../../../src/lib/auth/drive-grant';
import { DRIVE_SCOPE } from '../../../src/lib/auth/google-oauth';

const granted = {
  approvedBy: 'sub-1',
  signedInAs: 'sub-1',
  tokens: { scope: `openid ${DRIVE_SCOPE}`, refresh_token: 'rt' },
};

describe('checkDriveGrant', () => {
  it('goes ahead with the refresh token when everything is in order', () => {
    expect(checkDriveGrant(granted)).toEqual({ ok: true, refreshToken: 'rt' });
  });

  it('turns back a grant approved by a different Google account, and logs it', () => {
    expect(checkDriveGrant({ ...granted, approvedBy: 'sub-2' })).toEqual({
      ok: false,
      result: 'error',
      log: '[auth callback] drive grant from a different account',
    });
  });

  it('says denied when the Drive permission was unticked, with nothing to log', () => {
    expect(
      checkDriveGrant({
        ...granted,
        tokens: { ...granted.tokens, scope: 'openid' },
      }),
    ).toEqual({ ok: false, result: 'denied' });
  });

  it('treats a missing scope as denied too', () => {
    expect(
      checkDriveGrant({
        ...granted,
        tokens: { refresh_token: 'rt', scope: undefined },
      }),
    ).toEqual({ ok: false, result: 'denied' });
  });

  it('turns back a grant without a refresh token, and logs it', () => {
    expect(
      checkDriveGrant({
        ...granted,
        tokens: { scope: granted.tokens.scope, refresh_token: undefined },
      }),
    ).toEqual({
      ok: false,
      result: 'error',
      log: '[auth callback] drive grant carried no refresh token',
    });
  });

  it('checks the account before anything else', () => {
    expect(
      checkDriveGrant({
        approvedBy: 'a',
        signedInAs: 'b',
        tokens: { scope: 'openid', refresh_token: undefined },
      }),
    ).toMatchObject({ result: 'error' });
  });
});
