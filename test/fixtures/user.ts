import type { User } from '@/domain/db/users';

/** A complete user row; a test names only the columns it cares about. */
export const aUser = (overrides: Partial<User> = {}): User => ({
  id: 1,
  google_sub: 'google-sub-1',
  email: 'person@example.com',
  name: null,
  picture: null,
  refresh_token_enc: null,
  recipes_folder_id: null,
  units: null,
  session_epoch: 0,
  last_synced_at: null,
  backfill_lease_until: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  ...overrides,
});
