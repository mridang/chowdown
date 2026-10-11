/**
 * Sign out: clear the session cookie and return home. Supports GET (a plain
 * link) and POST (a form button).
 */

import { NextRequest, NextResponse } from 'next/server';

import { SESSION_COOKIE } from '@/lib/auth/session';
import { appOrigin } from '@/lib/util';

function clear(request: NextRequest): NextResponse {
  const response = NextResponse.redirect(appOrigin(request), { status: 303 });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return clear(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return clear(request);
}
