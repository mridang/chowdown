'use client';

import { useCallback, useEffect, useState } from 'react';

/** Chrome's install prompt event, which TypeScript's DOM types don't include. */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Lets the page offer "Install app" when the browser says the site can be
 * installed. `install` is undefined until then (and after it has been used, or
 * when the app is already installed), so callers show the option only when it
 * works. Chrome and Edge fire the event; Safari has its own Share menu route.
 */
export function useInstallPrompt(): { install?: () => Promise<void> } {
  const [event, setEvent] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallPromptEvent);
    };
    const onInstalled = () => setEvent(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!event) {
      return;
    }
    await event.prompt();
    await event.userChoice;
    setEvent(null);
  }, [event]);

  return event ? { install } : {};
}
