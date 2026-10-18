'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker (see `public/sw.js`) once the page has loaded, so
 * the app is installable and shows an offline page. It does nothing in
 * development, where a worker would hold on to stale pages.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== 'production' ||
      !('serviceWorker' in navigator)
    ) {
      return;
    }
    const register = () => {
      void navigator.serviceWorker.register('/sw.js', { scope: '/' });
    };
    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register, { once: true });
      return () => window.removeEventListener('load', register);
    }
  }, []);
  return null;
}
