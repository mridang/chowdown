'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { parseRecipe, type ParsedRecipe } from '../_lib/cooklang';
import {
  createRecipe,
  type DriveFile,
  ensureGoogleLibs,
  fetchDriveFile,
  isGoogleConfigured,
  listFolderRecipes,
  openPicker,
  pickFolder,
  requestAccessToken,
} from '../_lib/google';
import { FolderPanel } from './folder-panel';
import { RecipeView } from './recipe-view';

/**
 * The interactive heart of the app: open a `.cook` file (from Drive, a
 * Drive folder, or local disk), browse a folder's recipes, add new ones,
 * and render the result. All Google interaction is client-side.
 */
export function Viewer() {
  const [recipe, setRecipe] = useState<ParsedRecipe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [folder, setFolder] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const configured = isGoogleConfigured();

  // Cached Drive token, so listing/opening/creating don't re-prompt sign-in.
  const tokenRef = useRef<string | null>(null);

  const render = useCallback((source: string, name: string) => {
    try {
      setRecipe(parseRecipe(source, name));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const ensureToken = useCallback(async () => {
    if (tokenRef.current) {
      return tokenRef.current;
    }
    await ensureGoogleLibs();
    const token = await requestAccessToken();
    tokenRef.current = token;
    return token;
  }, []);

  // Wrap an async Drive action with busy/error handling.
  const run = useCallback(async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
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

  const openFromDrive = useCallback(
    () =>
      run(async () => {
        const token = await ensureToken();
        const file = await openPicker(token);
        if (file) {
          setActiveId(file.id);
          render(await fetchDriveFile(file.id, token), file.name);
        }
      }),
    [run, ensureToken, render],
  );

  const openFolder = useCallback(
    () =>
      run(async () => {
        const token = await ensureToken();
        const picked = await pickFolder(token);
        if (picked) {
          setFolder(picked);
          setFiles(await listFolderRecipes(picked.id, token));
        }
      }),
    [run, ensureToken],
  );

  const openListedFile = useCallback(
    (file: DriveFile) =>
      run(async () => {
        const token = await ensureToken();
        setActiveId(file.id);
        render(await fetchDriveFile(file.id, token), file.name);
      }),
    [run, ensureToken, render],
  );

  const addRecipe = useCallback(
    (name: string, content: string) =>
      run(async () => {
        if (!folder) {
          return;
        }
        const token = await ensureToken();
        const created = await createRecipe(folder.id, name, content, token);
        setFiles(await listFolderRecipes(folder.id, token));
        setActiveId(created.id);
        render(content, created.name);
      }),
    [run, ensureToken, render, folder],
  );

  const openLocal = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        setActiveId(null);
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
          {busy ? 'Working…' : 'Open from Drive'}
        </button>
        <button
          type="button"
          onClick={openFolder}
          disabled={busy || !configured}
          className="rounded-md border border-slate-200 bg-white px-3.5 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
        >
          Open Drive folder
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

      {folder ? (
        <FolderPanel
          folderName={folder.name}
          files={files}
          activeId={activeId}
          busy={busy}
          onOpenFile={openListedFile}
          onAddRecipe={addRecipe}
        />
      ) : null}

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
