import type { MetadataRoute } from 'next';

/**
 * The web app manifest: what makes chowdown installable from Chrome and Safari
 * and what the installed app looks like. The theme colour is the marigold of the
 * header strip, so the browser's top bar and the installed app's title bar match
 * the site; the background is the page colour, shown while the app starts.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'chowdown — recipe keeper',
    short_name: 'chowdown',
    description:
      'Your recipes, kept as plain text in your own Google Drive. Search, scale and cook from them, and ask your AI assistant about them.',
    lang: 'en',
    dir: 'ltr',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#fbf8f2',
    theme_color: '#ffb100',
    categories: ['food', 'lifestyle'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Recipes',
        url: '/app',
        description: 'Browse and search your recipes',
      },
      {
        name: 'Favourites',
        url: '/app?fav=1',
        description: 'Your favourite recipes',
      },
      {
        name: 'Add recipes',
        url: '/recipes/add',
        description: 'Save a new recipe',
      },
    ],
  };
}
