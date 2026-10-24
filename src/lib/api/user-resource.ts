/**
 * @packageDocumentation
 *
 * The signed-in user on the wire (`/api/users/self`): what is shown, and which
 * setting can be changed. Identity (name, email, picture) comes from Google and
 * is read-only; the measurement system is the one editable preference.
 */

import type { User } from '@/lib/db/users';
import { listOr } from '@/lib/intl';

/** The measurement systems a user can prefer. */
export const MEASUREMENT_SYSTEMS = ['METRIC', 'US', 'IMPERIAL'] as const;

/** One of {@link MEASUREMENT_SYSTEMS}. */
export type MeasurementSystem = (typeof MEASUREMENT_SYSTEMS)[number];

/** The user as the API shows them. */
export interface UserResource {
  readonly id: string;
  readonly email: string;
  readonly name?: string;
  readonly picture_url?: string;
  readonly measurement_system?: MeasurementSystem;
}

/** The stored (lower-case) form of a measurement system. */
function stored(value: MeasurementSystem): string {
  return value.toLowerCase();
}

/** Narrow a value to one of the measurement systems. */
function isMeasurementSystem(value: unknown): value is MeasurementSystem {
  return (MEASUREMENT_SYSTEMS as readonly unknown[]).includes(value);
}

/** The user's representation. */
export function userResource(user: Readonly<User>): UserResource {
  const units = user.units?.toUpperCase();
  return {
    id: String(user.id),
    email: user.email,
    ...(user.name ? { name: user.name } : {}),
    ...(user.picture ? { picture_url: user.picture } : {}),
    ...(isMeasurementSystem(units) ? { measurement_system: units } : {}),
  };
}

/** A validated change to the user, or what was wrong with it. */
export type UserPatch =
  | { readonly ok: true; readonly units: string | null }
  | { readonly ok: false; readonly errors: readonly string[] };

/**
 * Validate a merge patch for the user. Only `measurement_system` can change; it
 * is set to one of the allowed values, or cleared with `null`.
 */
export function parseUserPatch(
  patch: Readonly<Record<string, unknown>>,
): UserPatch {
  const value = patch['measurement_system'];
  const errors = [
    ...Object.keys(patch)
      .filter((key) => key !== 'measurement_system')
      .map((key) => `${key}: not editable (editable: measurement_system).`),
    ...('measurement_system' in patch &&
    value !== null &&
    !isMeasurementSystem(value)
      ? [
          `measurement_system: must be ${listOr([...MEASUREMENT_SYSTEMS, 'null'])}.`,
        ]
      : []),
  ];
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    units: isMeasurementSystem(value) ? stored(value) : null,
  };
}
