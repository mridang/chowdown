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

import { formatQuantityNumber } from '../intl';
import type { ParsedIngredient, ParsedRecipe, StepToken } from './cooklang';

/** Supported measurement systems. */
export type UnitSystem = 'metric' | 'us' | 'imperial';

/** Narrow an arbitrary string to a {@link UnitSystem}. */
export function isUnitSystem(value: string): value is UnitSystem {
  return value === 'metric' || value === 'us' || value === 'imperial';
}

/** Mass units → grams. */
const MASS_TO_G: Record<string, number> = {
  g: 1, gram: 1, grams: 1, kg: 1000, kgs: 1000, mg: 0.001,
  kilo: 1000, kilos: 1000, kilogram: 1000, kilograms: 1000, gr: 1, gm: 1, gms: 1,
  oz: 28.3495, ounce: 28.3495, ounces: 28.3495,
  lb: 453.592, lbs: 453.592, pound: 453.592, pounds: 453.592,
};

/** Volume units → millilitres (cup/tbsp/tsp assumed US when used as a source). */
const VOL_TO_ML: Record<string, number> = {
  ml: 1, milliliter: 1, millilitre: 1, milliliters: 1, millilitres: 1, l: 1000, liter: 1000, litre: 1000,
  liters: 1000, litres: 1000, dl: 100, cl: 10, tbs: 14.7868, tbsps: 14.7868, tsps: 4.92892, qt: 946.353, pt: 473.176,
  tsp: 4.92892, teaspoon: 4.92892, teaspoons: 4.92892,
  tbsp: 14.7868, tablespoon: 14.7868, tablespoons: 14.7868,
  cup: 236.588, cups: 236.588,
  floz: 29.5735, pint: 473.176, pints: 473.176, quart: 946.353, quarts: 946.353,
};

/** Target volume unit sizes (ml) per system, largest first. */
const VOL_TARGETS: Record<UnitSystem, [string, number][]> = {
  metric: [['l', 1000], ['ml', 1]],
  us: [['cup', 236.588], ['tbsp', 14.7868], ['tsp', 4.92892]],
  imperial: [['cup', 284.131], ['tbsp', 17.7582], ['tsp', 5.91939]],
};

/** Round to `step` (e.g. 0.25) then drop trailing zeros. */
function roundTo(value: number, step: number): string {
  const rounded = Math.round(value / step) * step;
  return formatQuantityNumber(rounded);
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
    return grams >= 1000 ? `${roundTo(grams / 1000, 0.01)} kg` : `${roundTo(grams, 1)} g`;
  }
  const oz = grams / 28.3495;
  return oz >= 16 ? `${roundTo(oz / 16, 0.05)} lb` : `${roundTo(oz, 0.1)} oz`;
}

/** Format a volume given in millilitres for the target system. */
function formatVolume(ml: number, system: UnitSystem): string {
  for (const [unit, size] of VOL_TARGETS[system]) {
    if (ml >= size) {
      const step = unit === 'ml' ? 1 : unit === 'l' ? 0.01 : unit === 'cup' ? 0.25 : 0.5;
      const amount = roundTo(ml / size, step);
      return `${amount} ${unit === 'cup' && Number(amount) > 1 ? 'cups' : unit}`;
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
  const unit = match[2]!.trim().toLowerCase().replace(/\./g, '').replace('fl oz', 'floz');
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
    return system === 'metric' ? `${Math.round(value)} °C` : `${Math.round((value * 9) / 5 + 32)} °F`;
  }
  if (unit === 'f' || unit === '°f' || unit === 'fahrenheit') {
    return system === 'metric' ? `${Math.round(((value - 32) * 5) / 9)} °C` : `${Math.round(value)} °F`;
  }
  return quantity;
}

/** Convert every quantity in a parsed recipe to the target system. */
export function convertRecipe(recipe: ParsedRecipe, system: UnitSystem): ParsedRecipe {
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

/** Fractions worth showing as fractions: `[value, label]`. */
const NICE_FRACTIONS: [number, string][] = [
  [0.125, '1/8'],
  [0.25, '1/4'],
  [1 / 3, '1/3'],
  [0.5, '1/2'],
  [2 / 3, '2/3'],
  [0.75, '3/4'],
];

/** A number as a cook writes it: "1 1/2", "3/4", "2.4". */
function formatAmount(value: number): string {
  const whole = Math.floor(value + 1e-9);
  const rest = value - whole;
  if (rest < 0.03) {
    return String(whole);
  }
  const near = NICE_FRACTIONS.find(([f]) => Math.abs(rest - f) < 0.03);
  if (near) {
    return whole > 0 ? `${whole} ${near[1]}` : near[1];
  }
  if (rest > 0.97) {
    return String(whole + 1);
  }
  return formatQuantityNumber(value, 1);
}

/** One number as written in a quantity: "2", "1.5", "1/2" or "1 1/2". */
const AMOUNT = String.raw`\d+(?:[.,]\d+)?(?:\s+\d+\s*\/\s*\d+|\s*\/\s*\d+)?`;
const SCALABLE = new RegExp(
  `^(${AMOUNT})(?:\\s*[-–]\\s*(${AMOUNT}))?\\s*(.*)$`,
);

/** Vulgar-fraction characters and what they are worth. */
const FRACTION_GLYPHS: Record<string, number> = {
  '½': 1 / 2,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '¼': 1 / 4,
  '¾': 3 / 4,
  '⅛': 1 / 8,
  '⅜': 3 / 8,
  '⅝': 5 / 8,
  '⅞': 7 / 8,
};

/** The value of an amount like "1 1/2" or "3/4" or "2,5"; undefined if it isn't one. */
function amountValue(text: string): number | undefined {
  // "1,000" is a thousand; "2,5" is two and a half.
  if (/^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(text)) {
    return Number(text.replace(/,/g, ''));
  }
  const glyph = /^(\d+)?\s*([½⅓⅔¼¾⅛⅜⅝⅞])$/.exec(text);
  if (glyph) {
    return Number(glyph[1] ?? 0) + FRACTION_GLYPHS[glyph[2]!]!;
  }
  const mixed = /^(\d+)\s+(\d+)\s*\/\s*(\d+)$/.exec(text);
  if (mixed) {
    return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  }
  const frac = /^(\d+)\s*\/\s*(\d+)$/.exec(text);
  if (frac) {
    return Number(frac[1]) / Number(frac[2]);
  }
  const n = Number(text.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Scale a quantity by a factor ("2 tbsp" × 2 → "4 tbsp", "1/2 cup" × 3 →
 * "1 1/2 cup", "3-4" × 2 → "6-8"). Quantities that are not numbers ("a pinch",
 * "to taste") come back unchanged, and so does everything when the factor is 1.
 */
export function scaleQuantity(quantity: string, factor: number): string {
  if (factor === 1 || !Number.isFinite(factor) || factor <= 0) {
    return quantity;
  }
  const match = SCALABLE.exec(quantity.trim());
  if (!match) {
    return quantity;
  }
  const low = amountValue(match[1]!.trim());
  const high = match[2] ? amountValue(match[2].trim()) : undefined;
  if (low === undefined || (match[2] && high === undefined)) {
    return quantity;
  }
  const amount =
    high === undefined
      ? formatAmount(low * factor)
      : `${formatAmount(low * factor)}-${formatAmount(high * factor)}`;
  const unit = match[3]!.trim();
  return unit ? `${amount} ${unit}` : amount;
}

/** How much of something, in a base unit, so two quantities can be compared. */
export interface BaseAmount {
  dimension: 'mass' | 'volume' | 'count';
  /** Grams, millilitres, or a plain count. */
  amount: number;
  /** For a count: what is being counted ("cloves", "cans"), if anything. */
  unit?: string;
}

/**
 * A quantity ("400 g", "2 cups", "3", "2 cloves") as an amount in grams,
 * millilitres or a count, or undefined when it has no number. Lets callers
 * compare "400 g" with "1 lb" or "2 cups" with "500 ml".
 */
export function toBaseAmount(quantity: string): BaseAmount | undefined {
  const match =
    /^(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d*\s*[½⅓⅔¼¾⅛⅜⅝⅞]|\d+(?:[.,]\d+)?(?:\s+\d+\s*\/\s*\d+|\s*\/\s*\d+)?)\s*(.*)$/.exec(
      quantity.trim(),
    );
  if (!match) {
    return undefined;
  }
  const value = amountValue(match[1]!.trim());
  if (value === undefined) {
    return undefined;
  }
  const unit = match[2]!.trim().toLowerCase().replace(/\./g, '').replace('fl oz', 'floz');
  if (unit in MASS_TO_G) {
    return { dimension: 'mass', amount: value * MASS_TO_G[unit]! };
  }
  if (unit in VOL_TO_ML) {
    return { dimension: 'volume', amount: value * VOL_TO_ML[unit]! };
  }
  return unit ? { dimension: 'count', amount: value, unit } : { dimension: 'count', amount: value };
}
