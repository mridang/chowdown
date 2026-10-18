import { describe, expect, it } from '@jest/globals';

import {
  DriveNotConnectedError,
  driveAttemptOf,
  driveConnectHref,
  isDriveConnected,
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
    expect(driveConnectHref()).toBe('/api/auth/drive');
    expect(driveConnectHref('/recipes/add')).toBe(
      '/api/auth/drive?returnTo=%2Frecipes%2Fadd',
    );
  });

  it('encodes a return address that has a query of its own', () => {
    expect(driveConnectHref('/oauth/authorize?a=1&b=2')).toBe(
      '/api/auth/drive?returnTo=%2Foauth%2Fauthorize%3Fa%3D1%26b%3D2',
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
