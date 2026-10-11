import type { Note } from '@/lib/recipe/cook-text';
import type { ParsedRecipe, StepToken } from '@/lib/recipe/cooklang';
import { MEDIA_META_KEYS } from '@/lib/recipe/media';

/** A small amber note chip shown beside an ingredient or step. */
function NoteChip({ text }: { text: string }) {
  return (
    <span className="mt-1 block rounded-md bg-amber-50 px-2 py-1 text-[12px] text-amber-800">
      <span className="font-semibold">Note</span> {text}
    </span>
  );
}

/** Render a single step token: plain text or a coloured highlight chip. */
function Token({ token }: { token: StepToken }) {
  switch (token.kind) {
    case 'text':
      return <>{token.text}</>;
    case 'ingredient':
      return (
        <span
          title={token.quantity}
          className="rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-800"
        >
          {token.name}
        </span>
      );
    case 'cookware':
      return (
        <span className="rounded bg-teal-100 px-1.5 py-0.5 font-semibold text-teal-800">
          {token.name}
        </span>
      );
    case 'timer':
      return (
        <span className="rounded bg-violet-100 px-1.5 py-0.5 font-semibold text-violet-800">
          {token.label}
        </span>
      );
  }
}

/** The full recipe: metadata, an ingredients/cookware panel, and the method. */
export function RecipeView({
  recipe,
  notes = [],
}: {
  recipe: ParsedRecipe;
  /** Personal annotations to show inline and in a Notes section. */
  notes?: Note[];
}) {
  const ingredientNotes = (name: string) => {
    const lower = name.toLowerCase();
    return notes.filter((n) => {
      if (n.scope !== 'ingredient') {
        return false;
      }
      const key = n.key.toLowerCase();
      // Tolerant match: exact, or either name contains the other, so a note on
      // "lime" lands on "lime juice" (and an app note's exact name still works).
      return key === lower || lower.includes(key) || key.includes(lower);
    });
  };
  const stepNotes = (oneBased: number) =>
    notes.filter((n) => n.scope === 'step' && n.key === String(oneBased));
  const generalNotes = notes.filter((n) => n.scope === 'general');
  // Media (image/video URLs) renders as a gallery, not as raw metadata text.
  const metaRow = recipe.metadata.filter(
    ([key]) => !MEDIA_META_KEYS.has(key.toLowerCase()),
  );

  return (
    <article className="mt-6">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">
        {recipe.title}
      </h1>

      {metaRow.length > 0 ? (
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-slate-500">
          {metaRow.map(([key, value]) => (
            <span key={key}>
              <span className="font-semibold text-slate-600 capitalize">
                {key}
              </span>{' '}
              {value}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-[18rem_1fr]">
        <aside className="rounded-xl border border-slate-200 bg-white p-5">
          {recipe.ingredients.length > 0 ? (
            <>
              <h2 className="mb-3 text-xs font-semibold tracking-wider text-slate-500 uppercase">
                Ingredients
              </h2>
              <ul className="flex flex-col">
                {recipe.ingredients.map((ing, idx) => {
                  const ingNotes = ingredientNotes(ing.name);
                  return (
                    <li
                      key={`${ing.name}-${idx}`}
                      className="border-b border-slate-100 py-1.5 last:border-0"
                    >
                      <div className="flex justify-between gap-3">
                        <span>{ing.name}</span>
                        {ing.quantity ? (
                          <span className="whitespace-nowrap text-slate-500">
                            {ing.quantity}
                          </span>
                        ) : null}
                      </div>
                      {ingNotes.map((n, ni) => (
                        <NoteChip key={ni} text={n.text} />
                      ))}
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}

          {recipe.cookware.length > 0 ? (
            <>
              <h2 className="mt-6 mb-3 text-xs font-semibold tracking-wider text-slate-500 uppercase">
                Cookware
              </h2>
              <ul className="flex flex-col gap-1">
                {recipe.cookware.map((name, idx) => (
                  <li key={`${name}-${idx}`}>{name}</li>
                ))}
              </ul>
            </>
          ) : null}
        </aside>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-xs font-semibold tracking-wider text-slate-500 uppercase">
            Method
          </h2>
          <ol className="flex flex-col">
            {recipe.steps.map((step, idx) => (
              <li
                key={idx}
                className="flex gap-3.5 border-b border-slate-100 py-3.5 last:border-0"
              >
                <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-amber-600 text-sm font-bold text-white">
                  {idx + 1}
                </span>
                <div className="min-w-0">
                  <p className="leading-relaxed">
                    {step.map((token, ti) => (
                      <Token key={ti} token={token} />
                    ))}
                  </p>
                  {stepNotes(idx + 1).map((n, ni) => (
                    <NoteChip key={ni} text={n.text} />
                  ))}
                </div>
              </li>
            ))}
          </ol>

          {generalNotes.length > 0 ? (
            <div className="mt-6 border-t border-slate-100 pt-4">
              <h2 className="mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">
                Notes
              </h2>
              <ul className="flex flex-col gap-1.5">
                {generalNotes.map((n, ni) => (
                  <li
                    key={ni}
                    className="rounded-md bg-amber-50 px-3 py-1.5 text-[13px] text-amber-800"
                  >
                    {n.text}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </div>
    </article>
  );
}
