'use client';

import { useCallback, useEffect, useState } from 'react';

import { parseRecipe, type ParsedRecipe } from '../_lib/cooklang';
import {
  ensureGoogleLibs,
  fetchDriveFile,
  isGoogleConfigured,
  openPicker,
  requestAccessToken,
} from '../_lib/google';
import { RecipeView } from './recipe-view';

/**
 * The interactive heart of the app: a toolbar to open a `.cook` file
 * (from Drive or local disk) and the rendered recipe. All Google
 * interaction is client-side, so this is a client component.
 */
export function Viewer() {
  const [recipe, setRecipe] = useState<ParsedRecipe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const configured = isGoogleConfigured();

  const render = useCallback((source: string, name: string) => {
    try {
      setRecipe(parseRecipe(source, name));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  // Deep links: ?demo loads the bundled sample, ?file=<url> loads any .cook.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const url = params.has('demo')
      ? '/recipes/pancakes.cook'
      : params.get('file');
    if (!url) {
      return;
    }
    fetch(url)
      .then((res) => {
        if (!res.ok) {
          throw new Error(String(res.status));
        }
        return res.text();
      })
      .then((text) => render(text, url.split('/').pop() ?? 'recipe.cook'))
      .catch((err: unknown) =>
        setError(
          `Couldn't load ${url}: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
  }, [render]);

  const openFromDrive = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await ensureGoogleLibs();
      const token = await requestAccessToken();
      const file = await openPicker(token);
      if (file) {
        render(await fetchDriveFile(file.id, token), file.name);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [render]);

  const openLocal = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        render(await file.text(), file.name);
      }
      event.target.value = '';
    },
    [render],
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={openFromDrive}
          disabled={busy || !configured}
          className="rounded-md bg-amber-600 px-3.5 py-1.5 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
        >
          {busy ? 'Opening…' : 'Open from Drive'}
        </button>
        <label className="cursor-pointer rounded-md border border-slate-200 bg-white px-3.5 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50">
          Open local .cook
          <input
            type="file"
            accept=".cook,text/plain"
            hidden
            onChange={openLocal}
          />
        </label>
      </div>

      {!configured ? (
        <p className="mt-3 text-[13px] text-amber-700">
          Drive isn’t configured yet — set the{' '}
          <code className="rounded bg-amber-50 px-1">NEXT_PUBLIC_GOOGLE_*</code>{' '}
          env vars (see README). The local button works without it.
        </p>
      ) : null}

      {error ? <p className="mt-3 text-[13px] text-red-600">{error}</p> : null}

      {recipe ? (
        <RecipeView recipe={recipe} />
      ) : (
        <p className="mt-10 text-center text-slate-500">
          Open a <code className="rounded bg-slate-100 px-1">.cook</code> file
          to see it rendered.
        </p>
      )}
    </div>
  );
}
