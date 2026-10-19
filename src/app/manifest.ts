import type { MetadataRoute } from 'next';

/**
 * The launcher icon of one shortcut. Android draws shortcut icons at 48dp and
 * wants at least half the screen's density-scaled size, and web.dev recommends a
 * single 192px PNG when one size has to do, so that is what these are.
 */
function shortcutIcon(name: 'recipes' | 'favourites' | 'add'): {
  readonly src: string;
  readonly sizes: string;
  readonly type: string;
} {
  return {
    src: `/icons/shortcut-${name}-192.png`,
    sizes: '192x192',
    type: 'image/png',
  };
}

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
    // Chromium on desktop: a second launch (a shortcut, a link) reuses the open
    // window instead of stacking another.
    launch_handler: { client_mode: 'navigate-existing' },
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
      // Android 13+ themed icons colour this one themselves: only its shape
      // (the alpha channel) is used.
      {
        src: '/icons/icon-monochrome-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'monochrome',
      },
    ],
    // Chrome and Edge show these in their install dialog (the richer install
    // UI), which they only do when at least one screenshot exists per form
    // factor. They are drawn from a throwaway demo account with invented
    // recipes and drawn pictures, so nothing in them belongs to a real person.
    // Rules the browsers enforce, kept by test/app/manifest.test.ts: PNG or
    // JPEG, each side 320 to 3840px, the long side at most 2.3 times the short
    // one, one aspect ratio per form factor, at most eight.
    screenshots: [
      {
        src: '/screenshots/wide-1-library.png',
        sizes: '1280x800',
        type: 'image/png',
        form_factor: 'wide',
        label: 'Your recipe library, searchable and filterable',
      },
      {
        src: '/screenshots/wide-2-recipe.png',
        sizes: '1280x800',
        type: 'image/png',
        form_factor: 'wide',
        label: 'A recipe with its photo, facts and method',
      },
      {
        src: '/screenshots/narrow-1-library.png',
        sizes: '750x1624',
        type: 'image/png',
        form_factor: 'narrow',
        label: 'Your recipe library on a phone',
      },
      {
        src: '/screenshots/narrow-2-recipe.png',
        sizes: '750x1624',
        type: 'image/png',
        form_factor: 'narrow',
        label: 'A recipe on a phone',
      },
      {
        src: '/screenshots/narrow-3-cook.png',
        sizes: '750x1624',
        type: 'image/png',
        form_factor: 'narrow',
        label: 'Cook mode: one big step at a time, with timers',
      },
    ],
    // Chrome and Edge offer chowdown in the system share sheet once it is
    // installed. A GET to the add-recipes page carries the shared title, text
    // and address as query parameters; the page puts the address (or text) into
    // the importer's box and waits for the person to press the button, since
    // an import costs AI budget. See `recipes/add/_components/shared-input.ts`.
    share_target: {
      action: '/recipes/add',
      method: 'GET',
      params: { title: 'title', text: 'text', url: 'url' },
    },
    shortcuts: [
      {
        name: 'Recipes',
        url: '/app',
        description: 'Browse and search your recipes',
        icons: [shortcutIcon('recipes')],
      },
      {
        name: 'Favourites',
        url: '/app?fav=1',
        description: 'Your favourite recipes',
        icons: [shortcutIcon('favourites')],
      },
      {
        name: 'Add recipes',
        url: '/recipes/add',
        description: 'Save a new recipe',
        icons: [shortcutIcon('add')],
      },
    ],
  };
}
