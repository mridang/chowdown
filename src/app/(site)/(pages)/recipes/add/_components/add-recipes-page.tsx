'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useCallback,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';

import { ChevronLeftIcon, LinkIcon, NoteIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  FormField,
  FormMessage,
  TextArea,
  TextInput,
} from '@/components/ui/field';
import { Container, Eyebrow, Heading } from '@/components/ui/layout';
import { useFocusOnChange } from '@/components/ui/use-focus-on-change';
import { problemError, problemText } from '@/lib/rest-json';

import { AddRecipes } from '@/app/(site)/(pages)/recipes/add/_components/add-recipes';
import {
  createdRecipeId,
  postRecipe,
} from '@/app/(site)/(pages)/recipes/add/_components/recipe-requests';

/** Starter content offered when writing a recipe by hand. */
const STARTER = `>> title: New Recipe
>> servings: 2

Add @your ingredient{1} to a #pan{} and cook for ~{5%minutes}.
`;

/** Which part of the flow is showing: the two choices, or the one chosen. */
type Mode = 'choose' | 'import' | 'manual';

/** The manual "write it yourself" editor. */
function ManualEditor({
  onCancel,
}: Readonly<{ onCancel: () => void }>): ReactElement {
  const router = useRouter();
  const [name, setName] = useState('');
  const [content, setContent] = useState(STARTER);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Opened by pressing a card that has just gone, so focus starts on the heading.
  const heading = useFocusOnChange<HTMLHeadingElement>('write', null);

  const save = useCallback(async () => {
    if (!name.trim()) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await postRecipe(name, content);
      if (!res.ok) {
        throw await problemError(res);
      }
      const id = createdRecipeId(await res.json());
      if (id === undefined) {
        throw new Error('The server did not say which recipe it saved.');
      }
      router.push(`/recipe/${id}`);
      // ...and the list the router remembers should include it too.
      router.refresh();
    } catch (caught) {
      setError(problemText(caught, 'Could not save the recipe.'));
      setBusy(false);
    }
  }, [name, content, router]);

  return (
    <Card as="section" aria-labelledby="write-recipe-heading">
      <h2
        ref={heading}
        tabIndex={-1}
        id="write-recipe-heading"
        className="font-display text-2xl font-semibold tracking-tight outline-none"
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
    </Card>
  );
}

/** A big mode-choice card. */
function ChoiceCard({
  icon,
  title,
  description,
  onClick,
}: Readonly<{
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}>): ReactElement {
  return (
    <Card
      as="button"
      type="button"
      padding="lg"
      onClick={onClick}
      className="focus-ring flex flex-1 flex-col items-start text-left transition hover:border-ink/40"
    >
      <span className="grid size-11 place-items-center rounded-control bg-marigold/30">
        {icon}
      </span>
      <span className="mt-5 block font-display text-xl font-semibold">
        {title}
      </span>
      <span className="mt-2 block leading-relaxed text-muted">
        {description}
      </span>
    </Card>
  );
}

/**
 * The add-recipes flow: first choose how (import links/text, or write one by
 * hand), then run that flow. Import reuses the review wizard; writing opens the
 * editor. Both save to Drive and land you on the recipe (or back on the grid).
 */
export function AddRecipesPage({
  sharedInput = '',
}: Readonly<{
  /**
   * What was shared to the installed app, if anything. A share skips the two
   * choices (there is already something to import) and opens the importer with
   * it filled in.
   */
  sharedInput?: string;
}>): ReactElement {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(sharedInput ? 'import' : 'choose');
  // Coming back to the two choices (Back, from the editor) replaces the button
  // that was pressed, so focus goes to the page's own heading. Going the other
  // way, the section that opens takes focus itself.
  const heading = useFocusOnChange<HTMLHeadingElement>(
    mode === 'choose' ? 'choose' : null,
  );

  return (
    <Container className="py-8 sm:py-12">
      <div className="max-w-4xl">
        <Link
          href="/app"
          className="focus-ring-flush -ml-1 inline-flex h-9 items-center gap-1 rounded-control px-1 text-sm font-medium text-muted transition hover:text-ink"
        >
          <ChevronLeftIcon size="sm" />
          All recipes
        </Link>

        <Eyebrow className="mt-6">Grow your collection</Eyebrow>
        <Heading
          as="h1"
          variant="h1"
          className="mt-2 outline-none"
          ref={heading}
          tabIndex={-1}
        >
          Add recipes
        </Heading>

        {mode === 'choose' ? (
          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <ChoiceCard
              icon={<LinkIcon size="md" />}
              title="Import links or text"
              description="Paste recipe links, markdown or plain text — we fetch and convert each one, then you review and save."
              onClick={() => setMode('import')}
            />
            <ChoiceCard
              icon={<NoteIcon size="md" />}
              title="Write it myself"
              description="Type a recipe by hand in Cooklang and save it straight to your Drive."
              onClick={() => setMode('manual')}
            />
          </div>
        ) : null}

        {mode === 'import' ? (
          <div className="mt-8">
            <AddRecipes
              initialInput={sharedInput}
              onClose={() => router.push('/app')}
              // The list is cached by the router for a few minutes; make it
              // look again so the new recipes are in it when we get there.
              onSaved={() => router.refresh()}
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
