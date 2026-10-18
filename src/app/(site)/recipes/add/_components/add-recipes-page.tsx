'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useState, type ReactNode } from 'react';

import { ChevronLeftIcon, LinkIcon, NoteIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Container, Eyebrow, Heading } from '@/components/ui/layout';

import { AddRecipes } from './add-recipes';
import { FormField, FormMessage, TextArea, TextInput } from './form-fields';

/** Starter content offered when writing a recipe by hand. */
const STARTER = `>> title: New Recipe
>> servings: 2

Add @your ingredient{1} to a #pan{} and cook for ~{5%minutes}.
`;

type Mode = 'choose' | 'import' | 'manual';

/** The manual "write it yourself" editor. */
function ManualEditor({ onCancel }: { onCancel: () => void }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [content, setContent] = useState(STARTER);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useCallback(async () => {
    if (!name.trim()) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), cooklang: content }),
      });
      if (!res.ok) {
        throw new Error(String(res.status));
      }
      const created = (await res.json()) as { id: string };
      router.push(`/recipe/${created.id}`);
    } catch {
      setError('Could not save the recipe.');
      setBusy(false);
    }
  }, [name, content, router]);

  return (
    <section
      aria-labelledby="write-recipe-heading"
      className="rounded-card border-ink/10 border bg-white p-5 sm:p-8"
    >
      <h2
        id="write-recipe-heading"
        className="font-display text-2xl font-semibold tracking-tight"
      >
        Write a recipe
      </h2>
      <div className="mt-5 flex flex-col gap-5">
        <FormField id="recipe-name" label="Recipe name">
          <TextInput
            id="recipe-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Recipe name (e.g. Pancakes)"
          />
        </FormField>
        <FormField
          id="recipe-cook"
          label="Cooklang"
          hint="Mark ingredients with @, cookware with # and timers with ~."
        >
          <TextArea
            id="recipe-cook"
            mono
            aria-describedby="recipe-cook-hint"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={12}
            spellCheck={false}
          />
        </FormField>
      </div>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <div className="mt-5 flex flex-wrap gap-3">
        <Button
          size="lg"
          onClick={save}
          disabled={busy || !name.trim()}
          aria-busy={busy}
          className="disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save to Drive'}
        </Button>
        <Button variant="outline" size="lg" onClick={onCancel}>
          Back
        </Button>
      </div>
    </section>
  );
}

/** A big mode-choice card. */
function ChoiceCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-card border-ink/10 hover:border-ink/40 focus-visible:outline-ink flex flex-1 flex-col items-start border bg-white p-6 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 sm:p-8"
    >
      <span className="rounded-control bg-marigold/30 grid h-11 w-11 place-items-center">
        {icon}
      </span>
      <h2 className="font-display mt-5 text-xl font-semibold">{title}</h2>
      <p className="text-ink/75 mt-2 leading-relaxed">{description}</p>
    </button>
  );
}

/**
 * The add-recipes flow: first choose how (import links/text, or write one by
 * hand), then run that flow. Import reuses the review wizard; writing opens the
 * editor. Both save to Drive and land you on the recipe (or back on the grid).
 */
export function AddRecipesPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('choose');

  return (
    <Container className="py-8 sm:py-12">
      <div className="max-w-4xl">
        <Link
          href="/app"
          className="text-ink/75 hover:text-ink focus-visible:outline-ink rounded-control -ml-1 inline-flex h-9 items-center gap-1 px-1 text-sm font-medium transition focus-visible:outline-2"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          All recipes
        </Link>

        <Eyebrow className="mt-6">Grow your collection</Eyebrow>
        <Heading as="h1" variant="h1" className="mt-2">
          Add recipes
        </Heading>

        {mode === 'choose' ? (
          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <ChoiceCard
              icon={<LinkIcon className="h-5 w-5" />}
              title="Import links or text"
              description="Paste recipe links, markdown or plain text — we fetch and convert each one, then you review and save."
              onClick={() => setMode('import')}
            />
            <ChoiceCard
              icon={<NoteIcon className="h-5 w-5" />}
              title="Write it myself"
              description="Type a recipe by hand in Cooklang and save it straight to your Drive."
              onClick={() => setMode('manual')}
            />
          </div>
        ) : null}

        {mode === 'import' ? (
          <div className="mt-8">
            <AddRecipes
              onClose={() => router.push('/app')}
              onSaved={() => undefined}
            />
          </div>
        ) : null}

        {mode === 'manual' ? (
          <div className="mt-8">
            <ManualEditor onCancel={() => setMode('choose')} />
          </div>
        ) : null}
      </div>
    </Container>
  );
}
