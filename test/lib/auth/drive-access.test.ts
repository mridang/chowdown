import { describe, expect, it } from '@jest/globals';

import {
  DriveNotConnectedError,
  driveAttemptOf,
  driveConnectHref,
  driveResultPath,
  isAuthFailure,
  isDriveConnected,
  sessionHintStale,
  wasDriveConnected,
} from '../../../src/lib/auth/drive-access';

describe('isDriveConnected', () => {
  it('is true only once a refresh token is stored', () => {
    expect(isDriveConnected({ refresh_token_enc: 'sealed' })).toBe(true);
    expect(isDriveConnected({ refresh_token_enc: null })).toBe(false);
    expect(isDriveConnected({ refresh_token_enc: '' })).toBe(false);
  });
});

describe('wasDriveConnected', () => {
  it('remembers a Recipes folder was once made', () => {
    expect(wasDriveConnected({ recipes_folder_id: 'folder-1' })).toBe(true);
    expect(wasDriveConnected({ recipes_folder_id: null })).toBe(false);
  });
});

describe('DriveNotConnectedError', () => {
  it('is recognisable as itself and as an Error', () => {
    const error = new DriveNotConnectedError();
    expect(error).toBeInstanceOf(DriveNotConnectedError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('DriveNotConnectedError');
  });
});

describe('driveConnectHref', () => {
  it('starts the connection, optionally coming back to a page', () => {
    expect(driveConnectHref()).toBe('/auth/drive');
    expect(driveConnectHref('/recipes/add')).toBe(
      '/auth/drive?returnTo=%2Frecipes%2Fadd',
    );
  });

  it('can insist on going to Google even when a login is on record', () => {
    expect(driveConnectHref('/app', { force: true })).toBe(
      '/auth/drive?returnTo=%2Fapp&force=1',
    );
    expect(driveConnectHref(undefined, { force: true })).toBe(
      '/auth/drive?force=1',
    );
  });

  it('encodes a return address that has a query of its own', () => {
    expect(driveConnectHref('/oauth/authorize?a=1&b=2')).toBe(
      '/auth/drive?returnTo=%2Foauth%2Fauthorize%3Fa%3D1%26b%3D2',
    );
  });
});

describe('driveAttemptOf', () => {
  it('reads the two outcomes a failed attempt can leave', () => {
    expect(driveAttemptOf('denied')).toBe('denied');
    expect(driveAttemptOf('error')).toBe('error');
  });

  it('ignores anything else, including repeats of the parameter', () => {
    expect(driveAttemptOf('<script>')).toBeUndefined();
    expect(driveAttemptOf(undefined)).toBeUndefined();
    expect(driveAttemptOf(['error', 'denied'])).toBe('error');
    expect(driveAttemptOf([])).toBeUndefined();
  });
});

describe('isAuthFailure', () => {
  it('is true when Google reports an invalid or revoked grant', () => {
    expect(
      isAuthFailure(
        new Error(
          'Token refresh failed: 400 {"error":"invalid_grant","error_description":"Token has been expired or revoked."}',
        ),
      ),
    ).toBe(true);
  });

  it('is false for our own misconfiguration, which must not wipe anyone’s connection', () => {
    expect(
      isAuthFailure(
        new Error('Token refresh failed: 401 {"error":"invalid_client"}'),
      ),
    ).toBe(false);
    expect(
      isAuthFailure(
        new Error('Token refresh failed: 400 {"error":"invalid_request"}'),
      ),
    ).toBe(false);
  });

  it('is false for transient failures that should not force a reconnect', () => {
    expect(
      isAuthFailure(new Error('Token refresh failed: 503 unavailable')),
    ).toBe(false);
    expect(isAuthFailure(new Error('fetch failed'))).toBe(false);
    expect(isAuthFailure(new Error('Drive list failed: 500'))).toBe(false);
  });

  it('copes with non-Error values', () => {
    expect(isAuthFailure('invalid_grant')).toBe(true);
    expect(isAuthFailure(undefined)).toBe(false);
  });
});

describe('sessionHintStale', () => {
  it('is stale when the cookie disagrees with the database', () => {
    expect(sessionHintStale(true, false)).toBe(true);
    expect(sessionHintStale(false, true)).toBe(true);
  });

  it('is fresh when they agree', () => {
    expect(sessionHintStale(true, true)).toBe(false);
    expect(sessionHintStale(false, false)).toBe(false);
  });

  it('treats a cookie from before the hint existed as stale, to reissue it once', () => {
    expect(sessionHintStale(undefined, true)).toBe(true);
    expect(sessionHintStale(undefined, false)).toBe(true);
  });
});

describe('driveResultPath', () => {
  it('lands on the recipe list with a fixed reason', () => {
    expect(driveResultPath('denied')).toBe('/app?drive=denied');
    expect(driveResultPath('error')).toBe('/app?drive=error');
  });
});
