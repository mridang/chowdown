/**
 * @packageDocumentation
 *
 * The text of `/.well-known/security.txt` (RFC 9116): who to tell about a
 * security problem, and until when this information can be trusted.
 */

import { SECURITY_CONTACT, SITE_URL } from './site';

/** The file's text, valid for a year from `now`. */
export function securityTxt(now: Date): string {
  const expires = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  return [
    `Contact: ${SECURITY_CONTACT}`,
    `Expires: ${expires.toISOString()}`,
    'Preferred-Languages: en',
    `Canonical: ${SITE_URL}/.well-known/security.txt`,
    `Policy: ${SITE_URL}/privacy`,
    '',
  ].join('\n');
}
