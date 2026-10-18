/**
 * The security contact file (RFC 9116).
 *
 *   GET /.well-known/security.txt
 */

import { securityTxt } from '@/lib/security-txt';

export function GET(): Response {
  return new Response(securityTxt(new Date()), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      // Re-read daily, so the expiry date keeps moving ahead.
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
