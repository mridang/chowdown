/**
 * @packageDocumentation
 *
 * The signed-in user on the wire (`/api/users/self`): what is shown, and which
 * setting can be changed. Identity (name, email, picture) comes from Google and
 * is read-only; the measurement system is the one editable preference.
 */

import type { User } from '../db/users';

/** The measurement systems a user can prefer. */
export const MEASUREMENT_SYSTEMS = ['METRIC', 'US', 'IMPERIAL'] as const;
export type MeasurementSystem = (typeof MEASUREMENT_SYSTEMS)[number];

/** The user as the API shows them. */
export interface UserResource {
  id: string;
  email: string;
  name?: string;
  picture_url?: string;
  measurement_system?: MeasurementSystem;
}

/** The stored (lower-case) form of a measurement system. */
function stored(value: MeasurementSystem): string {
  return value.toLowerCase();
}

/** The user's representation. */
export function userResource(user: User): UserResource {
  const resource: UserResource = { id: String(user.id), email: user.email };
  if (user.name) {
    resource.name = user.name;
  }
  if (user.picture) {
    resource.picture_url = user.picture;
  }
  const units = user.units?.toUpperCase();
  if ((MEASUREMENT_SYSTEMS as readonly string[]).includes(units ?? '')) {
    resource.measurement_system = units as MeasurementSystem;
  }
  return resource;
}

/** A validated change to the user, or what was wrong with it. */
export type UserPatch =
  | { ok: true; units: string | null }
  | { ok: false; errors: string[] };

/**
 * Validate a merge patch for the user. Only `measurement_system` can change; it
 * is set to one of the allowed values, or cleared with `null`.
 */
export function parseUserPatch(patch: Record<string, unknown>): UserPatch {
  const errors: string[] = [];
  for (const key of Object.keys(patch)) {
    if (key !== 'measurement_system') {
      errors.push(`${key}: not editable (editable: measurement_system).`);
    }
  }
  const value = patch['measurement_system'];
  if (
    'measurement_system' in patch &&
    value !== null &&
    !(MEASUREMENT_SYSTEMS as readonly unknown[]).includes(value)
  ) {
    errors.push(
      `measurement_system: must be one of ${MEASUREMENT_SYSTEMS.join(', ')}, or null.`,
    );
  }
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    units: value === null ? null : stored(value as MeasurementSystem),
  };
}
