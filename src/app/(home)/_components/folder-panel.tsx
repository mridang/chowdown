'use client';

import { useState } from 'react';

import type { DriveFile } from '../_lib/google';

const STARTER = `>> title: New Recipe
>> servings: 2

Add @your ingredient{1} to a #pan{} and cook for ~{5%minutes}.
`;

/** Lists the `.cook` files in a picked Drive folder and adds new ones. */
export function FolderPanel({
  folderName,
  files,
  activeId,
  busy,
  onOpenFile,
  onAddRecipe,
}: {
  folderName: string;
  files: DriveFile[];
  activeId: string | null;
  busy: boolean;
  onOpenFile: (file: DriveFile) => void;
  onAddRecipe: (name: string, content: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [content, setContent] = useState(STARTER);

  function submit() {
    if (!name.trim()) {
      return;
    }
    onAddRecipe(name.trim(), content);
    setAdding(false);
    setName('');
    setContent(STARTER);
  }

  return (
    <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
          📁 {folderName}
        </h2>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          disabled={busy}
          className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
        >
          {adding ? 'Cancel' : '+ Add recipe'}
        </button>
      </div>

      {adding ? (
        <div className="mt-3 flex flex-col gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Recipe name (e.g. Pancakes)"
            className="rounded-md border border-slate-200 px-2.5 py-1.5 text-sm"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            spellCheck={false}
            className="rounded-md border border-slate-200 px-2.5 py-1.5 font-mono text-[13px]"
          />
          <button
            type="button"
            onClick={submit}
            disabled={busy || !name.trim()}
            className="self-start rounded-md bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
          >
            Save to Drive
          </button>
        </div>
      ) : null}

      {files.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">
          No .cook files in this folder yet.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col">
          {files.map((file) => (
            <li key={file.id}>
              <button
                type="button"
                onClick={() => onOpenFile(file)}
                disabled={busy}
                className={`w-full rounded-md px-2.5 py-1.5 text-left text-sm transition hover:bg-slate-50 disabled:opacity-50 ${
                  file.id === activeId
                    ? 'bg-amber-50 font-semibold text-amber-800'
                    : 'text-slate-700'
                }`}
              >
                {file.name.replace(/\.cook$/i, '')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
