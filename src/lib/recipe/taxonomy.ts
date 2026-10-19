/**
 * @packageDocumentation
 *
 * The recipe taxonomy: a small, curated, closed vocabulary that both the
 * auto-tagger (Workers AI) and the facet filter share. We deliberately keep the
 * value lists short and human — "a proper taxonomy", not an enterprise ontology
 * — and map each facet onto a schema.org/Recipe field so the tags double as
 * structured data (see {@link ./schema-org}).
 *
 * `keywords` is the one open facet: free-form terms the model may invent. Every
 * other facet is closed — a value the model returns that isn't in the list is
 * dropped, so the vocabulary can't drift.
 */

/** One facet: the metadata key we write, the schema.org field, and its values. */
export interface Facet {
  /** The `>> key:` we write into the `.cook` file. */
  readonly key: string;
  /** Human label for the facet (sidebar heading). */
  readonly label: string;
  /** The closed set of allowed values, or `null` for an open facet (keywords). */
  values: readonly string[] | null;
  /** Whether a recipe can carry several values for this facet. */
  readonly multi: boolean;
  /**
   * Worked out from the recipe itself (see diet-type.ts) rather than written in
   * its file or chosen by the tagger, so it can't be set or patched by hand.
   */
  readonly derived?: boolean;
  /** Values have a natural order (Easy → Hard) that lists should keep. */
  readonly ordered?: boolean;
}

/** The facets, in the order the filter sidebar shows them. */
export const FACETS: readonly Facet[] = [
  {
    key: 'protein',
    label: 'Protein',
    multi: true,
    values: [
      'chicken',
      'beef',
      'pork',
      'lamb',
      'fish',
      'seafood',
      'egg',
      'paneer',
      'tofu',
      'beans',
      'vegetable',
    ],
  },
  {
    key: 'cuisine',
    label: 'Cuisine',
    multi: false,
    values: [
      'Indian',
      'Italian',
      'Chinese',
      'Thai',
      'Japanese',
      'Korean',
      'Vietnamese',
      'Mexican',
      'French',
      'Mediterranean',
      'Middle Eastern',
      'American',
      'British',
      'Spanish',
      'Greek',
    ],
  },
  {
    key: 'category',
    label: 'Course',
    multi: false,
    values: [
      'Breakfast',
      'Lunch',
      'Dinner',
      'Starter',
      'Main',
      'Side',
      'Dessert',
      'Snack',
      'Drink',
      'Sauce',
    ],
  },
  {
    key: 'diet_type',
    label: 'Diet',
    multi: false,
    derived: true,
    ordered: true,
    values: ['Vegan', 'Vegetarian', 'Pescatarian', 'Non-vegetarian'],
  },
  {
    key: 'diet',
    label: 'Dietary needs',
    multi: true,
    values: [
      'Gluten-free',
      'Dairy-free',
      'Nut-free',
      'Low-carb',
      'Keto',
      'Halal',
      'Kosher',
    ],
  },
  {
    key: 'difficulty',
    label: 'Difficulty',
    multi: false,
    ordered: true,
    values: ['Easy', 'Medium', 'Hard'],
  },
  {
    key: 'method',
    label: 'Method',
    multi: true,
    values: [
      'No-cook',
      'Stovetop',
      'Oven',
      'Grill',
      'Air-fryer',
      'Slow-cooker',
      'Pressure-cooker',
      'Deep-fry',
      'Bake',
      'Steam',
    ],
  },
  {
    key: 'keywords',
    label: 'Keywords',
    multi: true,
    values: null,
  },
];

/** A facet key (`'protein' | 'cuisine' | …`). */
export type FacetKey = (typeof FACETS)[number]['key'];

/** Look up a facet by its metadata key. */
export function facet(key: string): Facet | undefined {
  return FACETS.find((f) => f.key === key);
}

/** Case-insensitively canonicalise a value to its vocabulary spelling. */
export function canonicalValue(key: string, value: string): string | undefined {
  const f = facet(key);
  if (!f) {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  if (f.values === null) {
    // Open facet (keywords): keep as-is, just normalised to lower case.
    return trimmed.toLowerCase();
  }
  return f.values.find((v) => v.toLowerCase() === trimmed.toLowerCase());
}

/**
 * The values of one facet that a proposal actually earns: each one spelled the
 * way the vocabulary spells it, without repeats, and cut to the first one for
 * a facet that holds only a single value.
 */
function acceptedValues(f: Facet, raw: unknown): readonly string[] {
  const candidates: readonly unknown[] = Array.isArray(raw) ? raw : [raw];
  const accepted = [
    ...new Set(
      candidates.flatMap((candidate) => {
        const canon =
          typeof candidate === 'string'
            ? canonicalValue(f.key, candidate)
            : undefined;
        return canon ? [canon] : [];
      }),
    ),
  ];
  // Single-valued facet: take the first accepted value only.
  return f.multi ? accepted : accepted.slice(0, 1);
}

/**
 * Validate a map of proposed tags against the taxonomy, dropping anything not
 * in a closed facet's vocabulary. Returns one `[key, value]` pair per accepted
 * value (multi-valued facets expand to several pairs), ready to write as
 * `>> key: value` metadata.
 *
 * @param proposed - `{ facetKey: value | value[] }` as returned by the tagger.
 */
export function validateTags(
  proposed: Readonly<Record<string, unknown>>,
): readonly (readonly [string, string])[] {
  return (
    FACETS
      // Derived facets are worked out from the recipe, never taken from the model.
      .filter((f) => !f.derived)
      .flatMap((f) => {
        const accepted = acceptedValues(f, proposed[f.key]);
        if (accepted.length === 0) {
          return [];
        }
        // A multi-valued facet is emitted comma-joined so it stays one
        // metadata line.
        return [[f.key, accepted.join(', ')] as const];
      })
  );
}
