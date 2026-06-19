import type { ParsedRecipe, StepToken } from '../_lib/cooklang';

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
export function RecipeView({ recipe }: { recipe: ParsedRecipe }) {
  return (
    <article className="mt-6">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">
        {recipe.title}
      </h1>

      {recipe.metadata.length > 0 ? (
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-slate-500">
          {recipe.metadata.map(([key, value]) => (
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
                {recipe.ingredients.map((ing, idx) => (
                  <li
                    key={`${ing.name}-${idx}`}
                    className="flex justify-between gap-3 border-b border-slate-100 py-1.5 last:border-0"
                  >
                    <span>{ing.name}</span>
                    {ing.quantity ? (
                      <span className="whitespace-nowrap text-slate-500">
                        {ing.quantity}
                      </span>
                    ) : null}
                  </li>
                ))}
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
                <p className="leading-relaxed">
                  {step.map((token, ti) => (
                    <Token key={ti} token={token} />
                  ))}
                </p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </article>
  );
}
