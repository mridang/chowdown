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
 *
 * Ingredient names are free text, so most of this file is about not being
 * fooled: plant-based look-alikes ("vegan cream cheese", "coconut milk",
 * "eggplant"), plants and fish with animal names ("pigeon peas", "oyster
 * mushrooms"), and animal products with no obvious name ("worcestershire",
 * "'nduja", "kimchi").
 */

/** One of the four common eating styles a recipe can be sorted into. */
export type DietType =
  'Vegan' | 'Vegetarian' | 'Pescatarian' | 'Non-vegetarian';

/** Every eating style, strictest first. */
export const DIET_TYPES = [
  'Vegan',
  'Vegetarian',
  'Pescatarian',
  'Non-vegetarian',
] as const satisfies readonly DietType[];

const MEAT_NOUNS =
  'bacon|ham|chorizo|sausages?|pepperoni|meatballs?|mince|jerky|burgers?|nuggets?|steaks?|wings|chicken|beef|pork|meat|fish|shrimp|prawns?|tuna|salmon|crab|scallops?';

/**
 * "Vegan cream cheese", "meat-free mince", "chicken-free broth", "no-chicken
 * stock", "dairy free butter": the word says the animal product is absent, so
 * the phrase it qualifies (up to two words) is not one.
 */
const FREE_FROM = new RegExp(
  String.raw`\b(?:vegan|plant[\s-]?based|vegetarian|veggie|meatless|faux|mock|imitation|non[\s-]?dairy|(?:meat|dairy|egg|fish|chicken|beef|animal|lactose)[\s-]?free|no[\s-](?:chicken|beef|meat|fish|egg|dairy))[\s-]+(?:[\w']+[\s-]+)?[\w']+`,
  'g',
);

/** Plants and nuts dressed up as meat: "tofu chorizo", "mushroom bacon", "walnut meat". */
const PLANT_MEAT = new RegExp(
  String.raw`\b(?:tofu|tempeh|seitan|soy|soya|mushroom|jackfruit|eggplant|aubergine|walnut|cauliflower|chickpea|lentil|coconut|banana blossom)[\s-]+(?:${MEAT_NOUNS})\b`,
  'g',
);

/** Nut, seed and grain "milks", "butters" and "creams", and other non-dairy dairy. */
const PLANT_DAIRY =
  /\b(?:coconut|almond|soy|soya|oat|rice|cashew|hemp|nut|peanut|cocoa|cacao|shea|apple|hazelnut|macadamia|pea|walnut|pistachio|sunflower(?:\s+seed)?|sesame)[\s-]+(?:(?:milk|cream|butter|cheese|yoghurt|yogurt|mayo|mayonnaise|egg)\b[\s-]*)+|\bcream of (?:coconut|wheat|rice|tartar)\b|\bcreamed corn\b|\bcoconut cream\b/g;

/** Plants and other things that merely share a word with an animal product. */
const LOOK_ALIKES = new RegExp(
  [
    String.raw`\b(?:butter|buttercup|butternut)\s+(?:beans?|squash|lettuce)\b`,
    String.raw`\bbutternut\b|\beggplants?\b|\bjackfruit\b`,
    String.raw`\b(?:celery|rhubarb|chard)\s+ribs?\b|\bribs?\s+of\s+celery\b`,
    String.raw`\bcrab\s*apples?\b|\b(?:bean|tofu|soy)\s+curd\b`,
    String.raw`\b(?:egg|flax|chia)\s+(?:replacer|substitute|replacement)\b|\b(?:flax|chia)\s+eggs?\b`,
    String.raw`\blamb'?s\s+(?:lettuce|ear)\b|\bbeef(?:steak)?\s+tomato(?:es)?\b`,
    String.raw`\b(?:king |lobster |pearl |blue )?oyster\s+mushrooms?\b|\blobster\s+mushrooms?\b`,
    String.raw`\bpigeon\s+peas?\b|\bchicken of the woods\b|\bhen of the woods\b`,
    String.raw`\b(?:hot\s?dog|hamburger|burger|sausage)\s+(?:buns?|rolls?|bread)\b`,
    String.raw`\bpate\s+(?:brisee|sucree|sablee|a choux|feuilletee)\b|\bduck sauce\b`,
    String.raw`\bsuet[\s-]free\b|\bveg(?:etable|an)\s+suet\b|\bhoney(?:dew|comb)\b`,
    String.raw`\bcoconut\s+water\b|\bcocoa\b|\bdrumsticks?\b`,
  ].join('|'),
  'g',
);

/** Animal words that stand for an ingredient that is really something else. */
const REWRITES = [
  [/\bgoat'?s?\s+(milk|cheese|butter|yogh?urt|cream)\b/g, '$1'],
  [/\b(?:quail|duck|goose)\s+eggs?\b/g, 'egg'],
  [
    /\b(crab|lobster|shrimp|prawn|crayfish|clam|oyster|scallop)\s+meat\b/g,
    '$1',
  ],
  [/\b(tuna|salmon|swordfish|cod|halibut|fish)\s+steaks?\b/g, '$1'],
] as const satisfies readonly (readonly [RegExp, string])[];

/**
 * "chicken or vegetable stock": the meat is one choice among several, so the
 * recipe doesn't need it. Only applied to stock-style ingredients.
 */
const OPTIONAL_MEAT_STOCK = new RegExp(
  [
    String.raw`\b(?:chicken|beef|meat|lamb|pork|fish)(?:\s+(?:stock|broth|bouillon))?(?:\s+cubes?)?[\s(]*(?:/|or)\s*(?:vegetable|veggie|veg)\b`,
    String.raw`\b(?:vegetable|veggie|veg)(?:\s+(?:stock|broth|bouillon))?(?:\s+cubes?)?[\s(]*(?:/|or)\s*(?:chicken|beef|meat|lamb|pork|fish)(?:\s+(?:stock|broth|bouillon|cubes?))?\b`,
  ].join('|'),
  'g',
);

const MEAT =
  /\b(chicken|beef|pork|lamb|mutton|goat|veal|turkey|duck|duckling|goose|bacon|ham|hams|sausages?|chorizo|salami|pepperoni|prosciutto|pancetta|guanciale|mortadella|venison|rabbit|oxtail|brisket|steak|ribs?|meatballs?|meat|gelatin|gelatine|lard|tallow|suet|bone broth|liver|nduja|kielbasa|andouille|bresaola|pastrami|bologna|baloney|jamon|serrano ham|speck|lardons?|spam|schmaltz|dripping|drippings|crackling|foie gras|pate|sirloin|tenderloin|ribeye|rib-eye|chuck|shanks?|wings|hot dogs?|wieners?|frankfurters?|hotdogs?|hot-dogs?|hamburgers?|tripe|trotters|offal|quail|pigeon|squab|pheasant|partridge|bison|boar|kangaroo|ostrich|snails?|escargots?|gosht|murgh|murg|keema|kheema|qeema|marrow bones?|bone marrow|gammon|poultry|hen|capon|poussin|jerky|biltong|meatloaf|doner|gyros?|gizzards?|kidneys|sweetbreads|tongue|demi-glace|collagen|frog legs|guinea fowl|elk|moose|grouse|animal rennet)\b|^\s*(?:lean |extra lean )?mince\b/;

const FISH =
  /\b(fish|salmon|tuna|cod|codfish|haddock|trout|mackerel|sardines?|anchov(?:y|ies)|shrimps?|prawns?|crabs?|crabmeat|lobsters?|squid|calamari|octopus|clams?|mussels?|oysters?|scallops?|seafood|shellfish|bonito|katsuobushi|dashi|caviar|roe|surimi|eels?|tilapia|halibut|snapper|sea bass|crawfish|crayfish|swordfish|monkfish|catfish|whitefish|pollock|pollack|herring|kippers?|whitebait|bream|grouper|mahi mahi|barramundi|bass|plaice|sprats?|pilchards?|langoustines?|cockles?|whelks?|abalone|belacan|worcestershire|worcester sauce|nam pla|oyster sauce|shrimp paste|ikura|tobiko|unagi|hamachi|hake|turbot|lox|sashimi|cuttlefish|krill|perch|carp|mullet|pike|sea urchin|uni|clamato|taramasalata|bottarga|bagoong|kamaboko|machli|jhinga|kimchi|caesar|dover sole|lemon sole)\b/;

const DAIRY_OR_EGG =
  /\b(milk|butter|ghee|cheeses?|cream|creamed|creamer|yogh?urt|curd|dahi|lassi|eggs?|eggnog|meringue|honey|paneer|mayonnaise|mayo|aioli|whey|custard|buttermilk|parmesan|parmigiano|mozzarella|cheddar|feta|ricotta|mascarpone|halloumi|gruyere|brie|camembert|gouda|khoya|khoa|mawa|makhan|malai|doodh|chhena|anda|condensed milk|ice cream|casein|kefir|skyr|quark|gelato|creme fraiche|sour cream|cottage cheese|labneh|burrata|pecorino|manchego|gorgonzola|stilton|emmental|edam|provolone|fontina|taleggio|half and half|half-and-half|alfredo|tzatziki|bechamel|hollandaise|ranch|dulce de leche|queso|monterey jack|pepper jack|grana padano|asiago|cotija)\b/;

/** An ingredient name with accents, case and plant-based look-alikes taken out. */
function prepare(name: string): string {
  const plain = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2018\u2019]/g, "'")
    .toLowerCase();
  // The "chicken or vegetable" escape hatch only makes sense for stock-style
  // ingredients; "chicken or vegetable pie" really does contain chicken.
  const withoutChoices = /\b(?:stock|broth|bouillon|cubes?)\b/.test(plain)
    ? plain.replace(OPTIONAL_MEAT_STOCK, ' ')
    : plain;
  const withoutLookAlikes = withoutChoices
    .replace(FREE_FROM, ' ')
    .replace(PLANT_MEAT, ' ')
    .replace(PLANT_DAIRY, ' ')
    .replace(LOOK_ALIKES, ' ');
  return REWRITES.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    withoutLookAlikes,
  );
}

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
  const names = ingredientNames.filter((n) => n.trim() !== '').map(prepare);
  const mentions = (pattern: RegExp) => names.some((n) => pattern.test(n));

  const meatProtein = protein.some((p) =>
    ['chicken', 'beef', 'pork', 'lamb'].includes(p),
  );
  if (mentions(MEAT) || meatProtein) {
    return 'Non-vegetarian';
  }
  const fishProtein = protein.some((p) => ['fish', 'seafood'].includes(p));
  if (mentions(FISH) || fishProtein) {
    return 'Pescatarian';
  }
  const dairyProtein = protein.some((p) => ['egg', 'paneer'].includes(p));
  if (mentions(DAIRY_OR_EGG) || dairyProtein) {
    return 'Vegetarian';
  }
  // No ingredients to go on (an uncurated import, say) and nothing in the tags
  // pointing at an animal product: that's not evidence of vegan, just silence.
  return names.length === 0 ? undefined : 'Vegan';
}

/**
 * The eating styles that suit someone who eats `style`: a vegetarian can have
 * vegan dishes, a pescatarian vegan and vegetarian ones too, and a vegan only
 * vegan. "Non-vegetarian" means meat is wanted, so it stands alone.
 */
export function suitableFor(style: DietType): readonly DietType[] {
  switch (style) {
    case 'Vegan':
      return ['Vegan'];
    case 'Vegetarian':
      return ['Vegan', 'Vegetarian'];
    case 'Pescatarian':
      return ['Vegan', 'Vegetarian', 'Pescatarian'];
    default:
      return ['Non-vegetarian'];
  }
}
