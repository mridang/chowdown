/**
 * @packageDocumentation
 *
 * Sorting a recipe into one of the four common eating styles — vegan,
 * vegetarian, pescatarian or non-vegetarian — from what is actually in it.
 *
 * This is worked out from the ingredient list, never guessed by a model, so it
 * is the same every time and can be recomputed for any recipe. The rule is the
 * usual one: any meat or poultry makes it non-vegetarian; otherwise any fish or
 * shellfish makes it pescatarian; otherwise any dairy, egg or honey makes it
 * vegetarian; otherwise it is vegan.
 */

export type DietType =
  | 'Vegan'
  | 'Vegetarian'
  | 'Pescatarian'
  | 'Non-vegetarian';

export const DIET_TYPES: DietType[] = [
  'Vegan',
  'Vegetarian',
  'Pescatarian',
  'Non-vegetarian',
];

/** Phrases that look like an animal product but are not (or are plant-based). */
const NOT_ANIMAL =
  /\b(coconut|almond|soy|soya|oat|rice|cashew|hemp|nut|peanut|cocoa|shea|apple|plant-based|plant|vegan|vegetarian|dairy-free|non-dairy|veggie|meatless|mock|imitation)[\s-]+(milk|cream|butter|cheese|yoghurt|yogurt|chicken|beef|sausage|bacon|mince|meat|burger|fish|egg|mayo|mayonnaise)\b|\b(butter|buttercup|butternut)\s+(bean|beans|squash|lettuce)\b|\bbutternut\b|\beggplant\b|\bcream of tartar\b|\bcreamed corn\b|\bcoconut cream\b|\bjackfruit\b|\bplant-based\b|\bveggie\b|\bmeatless\b/g;

const MEAT =
  /\b(chicken|beef|pork|lamb|mutton|goat|veal|turkey|duck|goose|bacon|ham|sausages?|chorizo|salami|pepperoni|prosciutto|pancetta|guanciale|mortadella|venison|rabbit|oxtail|brisket|steak|ribs?|meatballs?|meat|gelatin|gelatine|lard|tallow|suet|bone broth|liver)\b/;

const FISH =
  /\b(fish|salmon|tuna|cod|haddock|trout|mackerel|sardines?|anchov(?:y|ies)|shrimps?|prawns?|crab|lobster|squid|calamari|octopus|clams?|mussels?|oysters?|scallops?|seafood|bonito|katsuobushi|dashi|caviar|roe|surimi|eel|tilapia|halibut|snapper|sea bass|crawfish|crayfish)\b/;

const DAIRY_OR_EGG =
  /\b(milk|butter|ghee|cheese|cream|yogh?urt|curd|dahi|eggs?|honey|paneer|mayonnaise|mayo|whey|custard|buttermilk|parmesan|parmigiano|mozzarella|cheddar|feta|ricotta|mascarpone|halloumi|gruyere|brie|camembert|gouda|khoya|mawa|condensed milk|ice cream)\b/;

/**
 * The eating style of a recipe from its ingredient names. `protein` (the
 * recipe's protein tags) is a second opinion for recipes whose ingredient list
 * is missing or too thin to tell.
 */
export function classifyDietType(
  ingredientNames: readonly string[],
  protein: readonly string[] = [],
): DietType {
  const names = ingredientNames.map((n) =>
    n.toLowerCase().replace(NOT_ANIMAL, ' '),
  );
  const any = (pattern: RegExp) => names.some((n) => pattern.test(n));

  const meatProtein = protein.some((p) =>
    ['chicken', 'beef', 'pork', 'lamb'].includes(p),
  );
  if (any(MEAT) || meatProtein) {
    return 'Non-vegetarian';
  }
  const fishProtein = protein.some((p) => ['fish', 'seafood'].includes(p));
  if (any(FISH) || fishProtein) {
    return 'Pescatarian';
  }
  const dairyProtein = protein.some((p) => ['egg', 'paneer'].includes(p));
  if (any(DAIRY_OR_EGG) || dairyProtein) {
    return 'Vegetarian';
  }
  return 'Vegan';
}
