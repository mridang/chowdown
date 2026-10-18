/**
 * The caller's own session. Deleting it signs them out; it is idempotent, so
 * signing out twice (or when already signed out) is fine.
 *
 *   DELETE /api/sessions/self → 204
 */

import { NextResponse } from 'next/server';

import { SESSION_COOKIE } from '@/lib/auth/session';
import { isSameOriginPost } from '@/lib/oauth/csrf';
import { problems } from '@/lib/api/problem';
import { appOrigin } from '@/lib/util';

export async function DELETE(request: Request): Promise<NextResponse> {
  // Signing someone out from another site is a nuisance attack; refuse it.
  if (!isSameOriginPost(request.headers, appOrigin(request))) {
    return problems.forbidden('Cross-site requests are not allowed.');
  }
  const response = new NextResponse(null, { status: 204 });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
