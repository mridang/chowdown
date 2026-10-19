import { NoteIcon } from '@/components/icons';
import { Card } from '@/components/ui/card';
import { Heading } from '@/components/ui/layout';
import { sentenceCase } from '@/lib/format';
import type { GeneralNote } from '@/lib/recipe/page-view';

import { AddNote } from './add-note';

/**
 * The reader's own notes about the recipe. Notes tied to an ingredient or step
 * show beside it; this lists the rest (whole-recipe notes, and any whose target
 * is gone), or a prompt to write the first one, then the "Add a note" form.
 */
export function RecipeNotes({
  recipeId,
  general,
  ingredients,
}: {
  recipeId: string;
  /** The notes that belong to the whole recipe. */
  general: GeneralNote[];
  /** Ingredient names, to offer as targets for a new note. */
  ingredients: string[];
}) {
  return (
    <section className="mt-14 max-w-3xl">
      <Heading variant="h3" className="flex items-center gap-2.5">
        <NoteIcon size="lg" className="text-ember" />
        Your notes
      </Heading>
      {general.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-3">
          {general.map((note, index) => (
            <Card as="li" padding="sm" key={index}>
              {note.label ? (
                <p className="text-label text-ember font-semibold uppercase">
                  {sentenceCase(note.label)}
                </p>
              ) : null}
              <p className="leading-relaxed">{note.text}</p>
            </Card>
          ))}
        </ul>
      ) : (
        <p className="text-subtle mt-3 text-sm print:hidden">
          Jot down what you changed so you can cook it your way next time. Your
          notes never change the original recipe.
        </p>
      )}
      <div className="mt-4 print:hidden">
        <AddNote recipeId={recipeId} ingredients={ingredients} />
      </div>
    </section>
  );
}
