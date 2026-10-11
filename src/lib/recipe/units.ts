/**
 * @packageDocumentation
 *
 * Deterministic conversion of recipe quantities between measurement systems, so
 * the MCP can show a recipe in the user's preferred units (metric, US, or
 * imperial) regardless of how it was written. Conversion is done on our side
 * (not the model's) so it is consistent and predictable.
 *
 * It handles the common cooking units — mass (g/kg/oz/lb), volume
 * (ml/l/tsp/tbsp/cup/fl oz) and temperature (°C/°F) — converting through a base
 * unit (grams, millilitres, °C) and re-expressing in the target system with
 * sensible rounding. Unknown units and plain counts (e.g. "2 eggs") are left
 * untouched.
 */

import type { ParsedIngredient, ParsedRecipe, StepToken } from './cooklang';

/** Supported measurement systems. */
export type UnitSystem = 'metric' | 'us' | 'imperial';

/** Narrow an arbitrary string to a {@link UnitSystem}. */
export function isUnitSystem(value: string): value is UnitSystem {
  return value === 'metric' || value === 'us' || value === 'imperial';
}

/** Mass units → grams. */
const MASS_TO_G: Record<string, number> = {
  g: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  kgs: 1000,
  mg: 0.001,
  oz: 28.3495,
  ounce: 28.3495,
  ounces: 28.3495,
  lb: 453.592,
  lbs: 453.592,
  pound: 453.592,
  pounds: 453.592,
};

/** Volume units → millilitres (cup/tbsp/tsp assumed US when used as a source). */
const VOL_TO_ML: Record<string, number> = {
  ml: 1,
  milliliter: 1,
  millilitre: 1,
  l: 1000,
  liter: 1000,
  litre: 1000,
  tsp: 4.92892,
  teaspoon: 4.92892,
  teaspoons: 4.92892,
  tbsp: 14.7868,
  tablespoon: 14.7868,
  tablespoons: 14.7868,
  cup: 236.588,
  cups: 236.588,
  floz: 29.5735,
  pint: 473.176,
  pints: 473.176,
  quart: 946.353,
  quarts: 946.353,
};

/** Target volume unit sizes (ml) per system, largest first. */
const VOL_TARGETS: Record<UnitSystem, [string, number][]> = {
  metric: [
    ['l', 1000],
    ['ml', 1],
  ],
  us: [
    ['cup', 236.588],
    ['tbsp', 14.7868],
    ['tsp', 4.92892],
  ],
  imperial: [
    ['cup', 284.131],
    ['tbsp', 17.7582],
    ['tsp', 5.91939],
  ],
};

/** Round to `step` (e.g. 0.25) then drop trailing zeros. */
function roundTo(value: number, step: number): string {
  const rounded = Math.round(value / step) * step;
  return parseFloat(rounded.toFixed(2)).toString();
}

/** Parse the leading number of a quantity string, supporting simple fractions. */
function parseNumber(text: string): number | null {
  const frac = /^(\d+)\s*\/\s*(\d+)$/.exec(text);
  if (frac) {
    return Number(frac[1]) / Number(frac[2]);
  }
  const n = Number(text.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Format a mass given in grams for the target system. */
function formatMass(grams: number, system: UnitSystem): string {
  if (system === 'metric') {
    return grams >= 1000
      ? `${roundTo(grams / 1000, 0.01)} kg`
      : `${roundTo(grams, 1)} g`;
  }
  const oz = grams / 28.3495;
  return oz >= 16 ? `${roundTo(oz / 16, 0.05)} lb` : `${roundTo(oz, 0.1)} oz`;
}

/** Format a volume given in millilitres for the target system. */
function formatVolume(ml: number, system: UnitSystem): string {
  for (const [unit, size] of VOL_TARGETS[system]) {
    if (ml >= size) {
      const step =
        unit === 'ml' ? 1 : unit === 'l' ? 0.01 : unit === 'cup' ? 0.25 : 0.5;
      return `${roundTo(ml / size, step)} ${unit}`;
    }
  }
  const smallest = VOL_TARGETS[system][VOL_TARGETS[system].length - 1]!;
  return `${roundTo(ml / smallest[1], 0.5)} ${smallest[0]}`;
}

/**
 * Convert a single quantity string (e.g. "200 g", "2 cups", "180 C") to the
 * target system. Returns the input unchanged when there is no number, no unit,
 * or the unit is not recognised (counts like "2" stay "2").
 */
export function convertQuantity(quantity: string, system: UnitSystem): string {
  const match = /^([\d.,/]+)\s*(.*)$/.exec(quantity.trim());
  if (!match) {
    return quantity;
  }
  const value = parseNumber(match[1]!.trim());
  const unit = match[2]!
    .trim()
    .toLowerCase()
    .replace(/\./g, '')
    .replace('fl oz', 'floz');
  if (value === null || !unit) {
    return quantity;
  }
  if (unit in MASS_TO_G) {
    return formatMass(value * MASS_TO_G[unit]!, system);
  }
  if (unit in VOL_TO_ML) {
    return formatVolume(value * VOL_TO_ML[unit]!, system);
  }
  if (unit === 'c' || unit === '°c' || unit === 'celsius') {
    return system === 'metric'
      ? `${Math.round(value)} °C`
      : `${Math.round((value * 9) / 5 + 32)} °F`;
  }
  if (unit === 'f' || unit === '°f' || unit === 'fahrenheit') {
    return system === 'metric'
      ? `${Math.round(((value - 32) * 5) / 9)} °C`
      : `${Math.round(value)} °F`;
  }
  return quantity;
}

/** Convert every quantity in a parsed recipe to the target system. */
export function convertRecipe(
  recipe: ParsedRecipe,
  system: UnitSystem,
): ParsedRecipe {
  const ingredients: ParsedIngredient[] = recipe.ingredients.map((i) => ({
    ...i,
    quantity: i.quantity ? convertQuantity(i.quantity, system) : i.quantity,
  }));
  const steps: StepToken[][] = recipe.steps.map((step) =>
    step.map((token) =>
      token.kind === 'ingredient' && token.quantity
        ? { ...token, quantity: convertQuantity(token.quantity, system) }
        : token,
    ),
  );
  return { ...recipe, ingredients, steps };
}
