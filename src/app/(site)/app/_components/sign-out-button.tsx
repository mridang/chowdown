'use client';

import { useCallback, useState } from 'react';

/**
 * Signs the user out by deleting their session, then returns to the home page.
 * (A plain link can't do this: signing out changes state, so it must not be a
 * GET.)
 */
export function SignOutButton() {
  const [busy, setBusy] = useState(false);

  const signOut = useCallback(async () => {
    setBusy(true);
    try {
      await fetch('/api/sessions/self', { method: 'DELETE' });
    } finally {
      window.location.assign('/');
    }
  }, []);

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={busy}
      className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
    >
      Sign out
    </button>
  );
}
