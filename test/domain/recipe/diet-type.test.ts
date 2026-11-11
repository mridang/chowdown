import { describe, expect, it } from '@jest/globals';

import {
  classifyDietType,
  DAIRY_OR_EGG,
  FISH,
  MEAT,
  PLANT_DAIRY,
} from '@/domain/recipe/diet-type';

import { expectSamePattern, fuzzInputs } from '../../regex-equivalence';
describe('classifyDietType', () => {
  it('calls anything with meat or poultry non-vegetarian', () => {
    expect(classifyDietType(['chicken thighs', 'rice'])).toBe('Non-vegetarian');
    expect(classifyDietType(['spaghetti', 'bacon', 'egg'])).toBe(
      'Non-vegetarian',
    );
    expect(classifyDietType(['beef stock', 'onion'])).toBe('Non-vegetarian');
    expect(classifyDietType(['chorizo'])).toBe('Non-vegetarian');
  });

  it('calls fish and shellfish without meat pescatarian', () => {
    expect(classifyDietType(['salmon fillet', 'lemon'])).toBe('Pescatarian');
    expect(classifyDietType(['prawns', 'garlic', 'butter'])).toBe(
      'Pescatarian',
    );
    expect(classifyDietType(['rice', 'fish sauce'])).toBe('Pescatarian');
  });

  it('calls dairy, egg and honey without meat or fish vegetarian', () => {
    expect(classifyDietType(['pasta', 'parmesan'])).toBe('Vegetarian');
    expect(classifyDietType(['eggs', 'spinach'])).toBe('Vegetarian');
    expect(classifyDietType(['paneer', 'tomato', 'ghee'])).toBe('Vegetarian');
    expect(classifyDietType(['oats', 'honey'])).toBe('Vegetarian');
  });

  it('calls a recipe with no animal products vegan', () => {
    expect(classifyDietType(['chickpeas', 'tomato', 'olive oil'])).toBe(
      'Vegan',
    );
  });

  it('is not fooled by plant-based look-alikes', () => {
    expect(classifyDietType(['coconut milk', 'curry paste', 'tofu'])).toBe(
      'Vegan',
    );
    expect(classifyDietType(['almond milk', 'peanut butter'])).toBe('Vegan');
    expect(
      classifyDietType(['eggplant', 'butternut squash', 'butter beans']),
    ).toBe('Vegan');
    expect(classifyDietType(['vegan cheese', 'plant-based chicken'])).toBe(
      'Vegan',
    );
  });

  it('leaves a recipe with no ingredients unclassified rather than vegan', () => {
    expect(classifyDietType([])).toBeUndefined();
    expect(classifyDietType([], ['vegetable'])).toBeUndefined();
  });

  it('knows cured and regional meats, and fish hiding in sauces', () => {
    expect(classifyDietType(["'nduja", 'pasta'])).toBe('Non-vegetarian');
    expect(classifyDietType(['jamón', 'melon'])).toBe('Non-vegetarian');
    expect(classifyDietType(['pâté', 'toast'])).toBe('Non-vegetarian');
    expect(classifyDietType(['lamb shanks', 'garlic'])).toBe('Non-vegetarian');
    expect(classifyDietType(['rice', 'oyster sauce'])).toBe('Pescatarian');
    expect(classifyDietType(['potatoes', 'worcestershire sauce'])).toBe(
      'Pescatarian',
    );
    expect(classifyDietType(['swordfish steak'])).toBe('Pescatarian');
    expect(classifyDietType(['catfish', 'cornmeal'])).toBe('Pescatarian');
  });

  it('is not fooled by words that merely contain an animal word', () => {
    expect(classifyDietType(['celery ribs', 'carrot'])).toBe('Vegan');
    expect(classifyDietType(['firm bean curd', 'soy sauce'])).toBe('Vegan');
    expect(classifyDietType(['flax egg', 'oat flour'])).toBe('Vegan');
    expect(classifyDietType(['garlic, mince', 'romano beans'])).toBe('Vegan');
    expect(classifyDietType(['crab apples', 'sugar'])).toBe('Vegan');
  });

  it("treats 'chicken or vegetable stock' as a choice, not a meat ingredient", () => {
    expect(classifyDietType(['chicken or vegetable stock', 'cheddar'])).toBe(
      'Vegetarian',
    );
    expect(classifyDietType(['vegetable or beef broth', 'onion'])).toBe(
      'Vegan',
    );
    expect(classifyDietType(['chicken stock', 'onion'])).toBe('Non-vegetarian');
  });

  it('lets the most restrictive ingredient win', () => {
    expect(classifyDietType(['salmon', 'chicken stock'])).toBe(
      'Non-vegetarian',
    );
    expect(classifyDietType(['tuna', 'cheddar'])).toBe('Pescatarian');
  });

  it('uses the protein tags when the ingredients are thin', () => {
    expect(classifyDietType([], ['chicken'])).toBe('Non-vegetarian');
    expect(classifyDietType([], ['seafood'])).toBe('Pescatarian');
    expect(classifyDietType([], ['egg'])).toBe('Vegetarian');
    expect(classifyDietType(['rice'], ['vegetable'])).toBe('Vegan');
  });
});

describe('classifyDietType — look-alikes and hidden animal products', () => {
  const V = 'Vegan';
  const VEG = 'Vegetarian';
  const P = 'Pescatarian';
  const N = 'Non-vegetarian';

  it.each([
    // plant-based substitutes named after the thing they replace
    ['vegan sausages', V],
    ['veggie meatballs', V],
    ['vegan ham', V],
    ['tofu chorizo', V],
    ['mushroom bacon', V],
    ['tempeh bacon', V],
    ['walnut meat', V],
    ['meat-free mince', V],
    ['chicken-free broth', V],
    ['no-chicken broth', V],
    ['vegan worcestershire sauce', V],
    ['vegan oyster sauce', V],
    ['vegan cream cheese', V],
    ['cashew cream cheese', V],
    ['vegan sour cream', V],
    ['vegan whipped cream', V],
    ['vegan honey', V],
    ['dairy free butter', V],
    ['macadamia milk', V],
    ['sunflower seed butter', V],
    ['cacao butter', V],
    ['cream of coconut', V],
    ['cream of wheat', V],
    ['vegan kimchi', V],
    // plants and fungi with animal names
    ['oyster mushrooms', V],
    ['pigeon peas', V],
    ['moringa drumsticks', V],
    ['lamb’s lettuce', V],
    ['beef tomatoes', V],
    ['cauliflower steak', V],
    ['cauliflower wings', V],
    ['hot dog buns', V],
    ['chicken of the woods', V],
    ['mock duck', V],
    ['pâte brisée', V],
    ['duck sauce', V],
    // animal products that are not the animal they sound like
    ['goat cheese', VEG],
    ["goat's milk", VEG],
    ['quail eggs', VEG],
    ['duck egg', VEG],
    ['crab meat', P],
    ['crabmeat', P],
    ['tuna steak', P],
    // hidden animal products
    ['kimchi', P],
    ['caesar dressing', P],
    ['shellfish stock', P],
    ['hamburger', N],
    ['mince', N],
    ['gammon', N],
    ['poultry seasoning, chicken', N],
    ['half and half', VEG],
    ['alfredo sauce', VEG],
    ['pepper jack cheese', VEG],
    ['tzatziki', VEG],
    ['hollandaise', VEG],
    ['eggnog', VEG],
  ])('%s → %s', (ingredient, expected) => {
    expect(classifyDietType([ingredient])).toBe(expected);
  });

  it('treats stock alternatives however they are written', () => {
    expect(
      classifyDietType(['chicken stock cubes or vegetable stock cubes']),
    ).toBe(V);
    expect(classifyDietType(['chicken stock (or vegetable)'])).toBe(V);
    expect(classifyDietType(['vegetable stock or chicken stock'])).toBe(V);
    expect(classifyDietType(['chicken stock'])).toBe(N);
    expect(classifyDietType(['chicken or vegetable stock, with chicken'])).toBe(
      N,
    );
  });

  it('does not take a gluten-free label as proof that the animal part is absent', () => {
    expect(classifyDietType(['gluten-free chicken stock'])).toBe(N);
  });

  it('does not treat blank names as ingredients', () => {
    expect(classifyDietType([''])).toBeUndefined();
    expect(classifyDietType(['  ', ''])).toBeUndefined();
  });

  it('is fast on very long input', () => {
    const started = Date.now();
    classifyDietType(['vegan ' + 'cream '.repeat(50_000)]);
    expect(Date.now() - started).toBeLessThan(500);
  });
});

describe('MEAT, rewritten', () => {
  const original = new RegExp(
    [
      String.raw`\b(chicken|beef|pork|lamb|mutton|goat|veal|turkey|duck|duckling|goose|`,
      'bacon|ham|hams|sausages?|chorizo|salami|pepperoni|prosciutto|pancetta|',
      'guanciale|mortadella|venison|rabbit|oxtail|brisket|steak|ribs?|meatbal',
      'ls?|meat|gelatin|gelatine|lard|tallow|suet|bone broth|liver|nduja|kiel',
      'basa|andouille|bresaola|pastrami|bologna|baloney|jamon|serrano ham|spe',
      'ck|lardons?|spam|schmaltz|dripping|drippings|crackling|foie gras|pate|',
      'sirloin|tenderloin|ribeye|rib-eye|chuck|shanks?|wings|hot dogs?|wiener',
      's?|frankfurters?|hotdogs?|hot-dogs?|hamburgers?|tripe|trotters|offal|q',
      'uail|pigeon|squab|pheasant|partridge|bison|boar|kangaroo|ostrich|snail',
      's?|escargots?|gosht|murgh|murg|keema|kheema|qeema|marrow bones?|bone m',
      'arrow|gammon|poultry|hen|capon|poussin|jerky|biltong|meatloaf|doner|gy',
      'ros?|gizzards?|kidneys|sweetbreads|tongue|demi-glace|collagen|frog leg',
      String.raw`s|guinea fowl|elk|moose|grouse|animal rennet)\b|^\s*(?:lean |extra lea`,
      String.raw`n )?mince\b`,
    ].join(''),
    '',
  );
  const pieces = [
    'chicken',
    'beef',
    'mince',
    'lean mince',
    ' ',
    'extra lean ',
    'bacon',
    'ham',
    'hams',
    'hot dog',
    'hot-dog',
    'hotdogs',
    'bone broth',
    'bone',
    'serrano ham',
    'x',
    '-',
    's',
    'foie gras',
    'pate',
    'tongue',
    'animal rennet',
    'elk',
    'moose',
    '\n',
    'Chicken',
  ];
  const table = [
    'chicken thighs',
    'beef stock',
    'lean mince',
    '  extra lean mince',
    'minced onion',
    'Chicken',
    'hot-dogs',
    'serrano ham',
    'bone broth',
    'shank',
    '',
    'tofu',
    'chuck steak',
  ];

  it('is the original pattern, rewritten', () => {
    expectSamePattern(original, MEAT, table);
  });

  it('finds the same things in random text', () => {
    expectSamePattern(original, MEAT, fuzzInputs(3000, 3000, pieces));
  });

  it('finds the same things in a very long input', () => {
    const long = fuzzInputs(3001, 1, pieces).join('').repeat(5000);
    expectSamePattern(original, MEAT, [long, 'x'.repeat(200_000)]);
  });
});

describe('FISH, rewritten', () => {
  const original = new RegExp(
    [
      String.raw`\b(fish|salmon|tuna|cod|codfish|haddock|trout|mackerel|sardines?|ancho`,
      'v(?:y|ies)|shrimps?|prawns?|crabs?|crabmeat|lobsters?|squid|calamari|o',
      'ctopus|clams?|mussels?|oysters?|scallops?|seafood|shellfish|bonito|kat',
      'suobushi|dashi|caviar|roe|surimi|eels?|tilapia|halibut|snapper|sea bas',
      's|crawfish|crayfish|swordfish|monkfish|catfish|whitefish|pollock|polla',
      'ck|herring|kippers?|whitebait|bream|grouper|mahi mahi|barramundi|bass|',
      'plaice|sprats?|pilchards?|langoustines?|cockles?|whelks?|abalone|belac',
      'an|worcestershire|worcester sauce|nam pla|oyster sauce|shrimp paste|ik',
      'ura|tobiko|unagi|hamachi|hake|turbot|lox|sashimi|cuttlefish|krill|perc',
      'h|carp|mullet|pike|sea urchin|uni|clamato|taramasalata|bottarga|bagoon',
      String.raw`g|kamaboko|machli|jhinga|kimchi|caesar|dover sole|lemon sole)\b`,
    ].join(''),
    '',
  );
  const pieces = [
    'fish',
    'salmon',
    'anchovy',
    'anchovies',
    'anchov',
    'sea bass',
    'sea urchin',
    'uni',
    'oyster sauce',
    'worcestershire',
    'kimchi',
    'caesar',
    'dover sole',
    'lemon sole',
    'crabs',
    'crab',
    'shrimp paste',
    ' ',
    '-',
    'x',
    's',
    'bass',
    'mahi mahi',
  ];
  const table = [
    'salmon fillet',
    'anchovies',
    'anchovy paste',
    'sea bass',
    'sea urchin',
    'oyster sauce',
    'worcestershire',
    '',
    'bassoon',
    'lemon sole',
    'tuna',
  ];

  it('is the original pattern, rewritten', () => {
    expectSamePattern(original, FISH, table);
  });

  it('finds the same things in random text', () => {
    expectSamePattern(original, FISH, fuzzInputs(4000, 3000, pieces));
  });

  it('finds the same things in a very long input', () => {
    const long = fuzzInputs(4001, 1, pieces).join('').repeat(5000);
    expectSamePattern(original, FISH, [long, 'x'.repeat(200_000)]);
  });
});

describe('DAIRY_OR_EGG, rewritten', () => {
  const original = new RegExp(
    [
      String.raw`\b(milk|butter|ghee|cheeses?|cream|creamed|creamer|yogh?urt|curd|dahi|`,
      'lassi|eggs?|eggnog|meringue|honey|paneer|mayonnaise|mayo|aioli|whey|cu',
      'stard|buttermilk|parmesan|parmigiano|mozzarella|cheddar|feta|ricotta|m',
      'ascarpone|halloumi|gruyere|brie|camembert|gouda|khoya|khoa|mawa|makhan',
      '|malai|doodh|chhena|anda|condensed milk|ice cream|casein|kefir|skyr|qu',
      'ark|gelato|creme fraiche|sour cream|cottage cheese|labneh|burrata|peco',
      'rino|manchego|gorgonzola|stilton|emmental|edam|provolone|fontina|taleg',
      'gio|half and half|half-and-half|alfredo|tzatziki|bechamel|hollandaise|',
      'ranch|dulce de leche|queso|monterey jack|pepper jack|grana padano|asia',
      String.raw`go|cotija)\b`,
    ].join(''),
    '',
  );
  const pieces = [
    'milk',
    'butter',
    'ghee',
    'cheese',
    'cheeses',
    'yogurt',
    'yoghurt',
    'yogurt',
    'half and half',
    'half-and-half',
    'monterey jack',
    'grana padano',
    'ice cream',
    'eggs',
    'egg',
    'anda',
    'dahi',
    ' ',
    '-',
    'x',
    's',
    'cotija',
    'cream',
    'creamed',
  ];
  const table = [
    'milk',
    'butter',
    'yoghurt',
    'yogurt',
    'half-and-half',
    'pepper jack',
    'ice cream',
    'eggs',
    '',
    'anda',
    'honey',
    'tofu',
  ];

  it('is the original pattern, rewritten', () => {
    expectSamePattern(original, DAIRY_OR_EGG, table);
  });

  it('finds the same things in random text', () => {
    expectSamePattern(original, DAIRY_OR_EGG, fuzzInputs(5000, 3000, pieces));
  });

  it('finds the same things in a very long input', () => {
    const long = fuzzInputs(5001, 1, pieces).join('').repeat(5000);
    expectSamePattern(original, DAIRY_OR_EGG, [long, 'x'.repeat(200_000)]);
  });
});

describe('PLANT_DAIRY, rewritten', () => {
  const original = new RegExp(
    [
      String.raw`\b(?:coconut|almond|soy|soya|oat|rice|cashew|hemp|nut|peanut|cocoa|cac`,
      String.raw`ao|shea|apple|hazelnut|macadamia|pea|walnut|pistachio|sunflower(?:\s+s`,
      String.raw`eed)?|sesame)[\s-]+(?:(?:milk|cream|butter|cheese|yoghurt|yogurt|mayo|`,
      String.raw`mayonnaise|egg)\b[\s-]*)+|\bcream of (?:coconut|wheat|rice|tartar)\b|`,
      String.raw`\bcreamed corn\b|\bcoconut cream\b`,
    ].join(''),
    'g',
  );
  const pieces = [
    'almond ',
    'oat ',
    'coconut ',
    'sunflower seed ',
    'sunflower ',
    'seed ',
    'milk',
    'cream',
    'butter',
    'egg',
    'mayo',
    ' ',
    '-',
    'cream of ',
    'wheat',
    'tartar',
    'creamed corn',
    'coconut cream',
    'x',
    'rice',
    'cheese ',
  ];
  const table = [
    'almond milk',
    'oat cream butter',
    'sunflower seed milk',
    'cream of tartar',
    'creamed corn',
    'coconut cream',
    'soy milk cheese',
    'sunflower  seed - milk',
    'nut egg',
    '',
    'milk',
  ];

  it('is the original pattern, rewritten', () => {
    expectSamePattern(original, PLANT_DAIRY, table);
  });

  it('finds the same things in random text', () => {
    expectSamePattern(original, PLANT_DAIRY, fuzzInputs(6000, 3000, pieces));
  });

  it('finds the same things in a very long input', () => {
    const long = fuzzInputs(6001, 1, pieces).join('').repeat(5000);
    expectSamePattern(original, PLANT_DAIRY, [long, 'x'.repeat(200_000)]);
  });
});
