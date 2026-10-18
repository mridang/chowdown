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
  /\b(coconut|almond|soy|soya|oat|rice|cashew|hemp|nut|peanut|cocoa|shea|apple|plant-based|plant|vegan|vegetarian|dairy-free|non-dairy|veggie|meatless|mock|imitation)[\s-]+(milk|cream|butter|cheese|yoghurt|yogurt|chicken|beef|sausage|bacon|mince|meat|burger|fish|egg|mayo|mayonnaise)\b|\b(butter|buttercup|butternut)\s+(bean|beans|squash|lettuce)\b|\bbutternut\b|\beggplant\b|\b(?:celery|rhubarb|chard)\s+ribs?\b|\bribs?\s+of\s+celery\b|\bcrab\s*apples?\b|\b(?:bean|tofu|soy)\s+curd\b|\b(?:egg|flax|chia)\s+(?:replacer|substitute|replacement)\b|\b(?:flax|chia)\s+eggs?\b|\bcream of tartar\b|\bcreamed corn\b|\bcoconut cream\b|\bjackfruit\b|\bplant-based\b|\bveggie\b|\bmeatless\b/g;

/**
 * "chicken or vegetable stock": the meat is one choice among several, so the
 * recipe doesn't need it. Only the stock-style ingredients are treated so.
 */
const OPTIONAL_MEAT_STOCK =
  /\b(?:chicken|beef|meat|lamb|pork|fish)(?:\s+(?:stock|broth|bouillon|cubes?))?\s*(?:\/|or)\s*(?:vegetable|veggie|veg)\s+(?:stock|broth|bouillon|cubes?)\b|\b(?:vegetable|veggie|veg)(?:\s+(?:stock|broth|bouillon|cubes?))?\s*(?:\/|or)\s*(?:chicken|beef|meat|lamb|pork|fish)\s+(?:stock|broth|bouillon|cubes?)\b/g;

const MEAT =
  /\b(chicken|beef|pork|lamb|mutton|goat|veal|turkey|duck|goose|bacon|ham|sausages?|chorizo|salami|pepperoni|prosciutto|pancetta|guanciale|mortadella|venison|rabbit|oxtail|brisket|steak|ribs?|meatballs?|meat|gelatin|gelatine|lard|tallow|suet|bone broth|liver|nduja|kielbasa|andouille|bresaola|pastrami|bologna|jamon|serrano ham|speck|lardons?|spam|schmaltz|dripping|drippings|crackling|foie gras|pate|sirloin|tenderloin|ribeye|rib-eye|chuck|shanks?|drumsticks?|wings|hot dogs?|wieners?|frankfurters?|hotdogs?|tripe|trotters|offal|quail|pigeon|squab|pheasant|partridge|bison|boar|kangaroo|ostrich|snails?|escargots?|gosht|murgh|keema|marrow bones?|bone marrow)\b/;

const FISH =
  /\b(fish|salmon|tuna|cod|haddock|trout|mackerel|sardines?|anchov(?:y|ies)|shrimps?|prawns?|crab|lobster|squid|calamari|octopus|clams?|mussels?|oysters?|scallops?|seafood|bonito|katsuobushi|dashi|caviar|roe|surimi|eel|tilapia|halibut|snapper|sea bass|crawfish|crayfish|swordfish|monkfish|catfish|whitefish|pollock|pollack|herring|kippers?|whitebait|bream|grouper|mahi mahi|barramundi|bass|plaice|sprats?|pilchards?|langoustines?|cockles?|whelks?|abalone|belacan|worcestershire|worcester sauce|nam pla|fish sauce|oyster sauce|shrimp paste|ikura|tobiko|unagi|hamachi)\b/;

const DAIRY_OR_EGG =
  /\b(milk|butter|ghee|cheese|cream|yogh?urt|curd|dahi|eggs?|honey|paneer|mayonnaise|mayo|whey|custard|buttermilk|parmesan|parmigiano|mozzarella|cheddar|feta|ricotta|mascarpone|halloumi|gruyere|brie|camembert|gouda|khoya|mawa|condensed milk|ice cream|casein|kefir|skyr|quark|paneer|gelato|creme fraiche|sour cream|cottage cheese|labneh|burrata|pecorino|manchego|gorgonzola|stilton|emmental|edam|provolone|fontina|taleggio)\b/;

/**
 * The eating style of a recipe from its ingredient names. `protein` (the
 * recipe's protein tags) is a second opinion for recipes whose ingredient list
 * is missing or too thin to tell. A recipe with no ingredients and no
 * telling protein is left unclassified rather than assumed vegan.
 */
export function classifyDietType(
  ingredientNames: readonly string[],
  protein: readonly string[] = [],
): DietType | undefined {
  const names = ingredientNames.map((n) =>
    n
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(OPTIONAL_MEAT_STOCK, ' ')
      .replace(NOT_ANIMAL, ' '),
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
  // No ingredients to go on (an uncurated import, say) and nothing in the tags
  // pointing at an animal product: that's not evidence of vegan, just silence.
  return names.length === 0 ? undefined : 'Vegan';
}
