/**
 * Sample data for the design sandbox, so every screen can be built and judged
 * without signing in or touching the database.
 */

/** A facet value with the colour it wears on cards and chips. */
export type Tone = 'flame' | 'marigold' | 'leaf' | 'plum' | 'bubblegum' | 'ink';

export interface SampleRecipe {
  id: string;
  title: string;
  site: string;
  minutes: number;
  servings: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  cuisine: string;
  protein: string;
  favourite: boolean;
  tone: Tone;
}

export const RECIPES: SampleRecipe[] = [
  {
    id: 'a',
    title: 'Smoky Chipotle Chicken Tacos',
    site: 'seriouseats.com',
    minutes: 35,
    servings: 4,
    difficulty: 'Easy',
    cuisine: 'Mexican',
    protein: 'chicken',
    favourite: true,
    tone: 'flame',
  },
  {
    id: 'b',
    title: 'Aloo Chapli Kabab',
    site: 'bongeats.com',
    minutes: 45,
    servings: 6,
    difficulty: 'Medium',
    cuisine: 'Indian',
    protein: 'vegetable',
    favourite: false,
    tone: 'marigold',
  },
  {
    id: 'c',
    title: 'Spätzle und Rindergulasch',
    site: 'thewoksoflife.com',
    minutes: 150,
    servings: 6,
    difficulty: 'Hard',
    cuisine: 'German',
    protein: 'beef',
    favourite: false,
    tone: 'plum',
  },
  {
    id: 'd',
    title: '15-Minute Coconut Curry Noodle Soup',
    site: 'eatwell101.com',
    minutes: 15,
    servings: 2,
    difficulty: 'Easy',
    cuisine: 'Thai',
    protein: 'chicken',
    favourite: true,
    tone: 'leaf',
  },
  {
    id: 'e',
    title: 'Mexican Meatballs with Salsa Verde',
    site: 'seriouseats.com',
    minutes: 50,
    servings: 4,
    difficulty: 'Medium',
    cuisine: 'Mexican',
    protein: 'beef',
    favourite: false,
    tone: 'bubblegum',
  },
  {
    id: 'f',
    title: 'Bacon and Cheddar Puff Pinwheels',
    site: 'eatwell101.com',
    minutes: 30,
    servings: 8,
    difficulty: 'Easy',
    cuisine: 'American',
    protein: 'pork',
    favourite: false,
    tone: 'marigold',
  },
  {
    id: 'g',
    title: 'Slow Roasted Lamb Shoulder',
    site: 'thewoksoflife.com',
    minutes: 240,
    servings: 6,
    difficulty: 'Medium',
    cuisine: 'Middle Eastern',
    protein: 'lamb',
    favourite: false,
    tone: 'flame',
  },
  {
    id: 'h',
    title: 'Broccoli Cheddar Soup',
    site: 'seriouseats.com',
    minutes: 40,
    servings: 4,
    difficulty: 'Easy',
    cuisine: 'American',
    protein: 'vegetable',
    favourite: true,
    tone: 'leaf',
  },
];

/** Sidebar facets with counts. */
export const FACETS: { label: string; values: [string, number][] }[] = [
  {
    label: 'Protein',
    values: [
      ['beans', 5],
      ['beef', 9],
      ['chicken', 26],
      ['egg', 10],
      ['lamb', 10],
      ['pork', 18],
      ['vegetable', 7],
    ],
  },
  {
    label: 'Cuisine',
    values: [
      ['American', 12],
      ['Indian', 32],
      ['Italian', 8],
      ['Mexican', 10],
      ['Thai', 5],
    ],
  },
  {
    label: 'Difficulty',
    values: [
      ['Easy', 41],
      ['Medium', 33],
      ['Hard', 11],
    ],
  },
];

export const SOURCES: [string, number][] = [
  ['thewoksoflife.com', 8],
  ['seriouseats.com', 7],
  ['banglarrannaghor.com', 4],
  ['eatwell101.com', 3],
];

/** The full recipe page sample. */
export const RECIPE_PAGE = {
  title: 'Smoky Chipotle Chicken Tacos',
  site: 'seriouseats.com',
  intro:
    'Chicken thighs braised in a smoky chipotle and tomato sauce, shredded and piled into warm corn tortillas. Make the sauce a day ahead and dinner takes ten minutes.',
  minutes: 35,
  servings: 4,
  difficulty: 'Easy',
  tags: ['Mexican', 'Chicken', 'Easy', 'Dinner', 'Weeknight'],
  ingredients: [
    ['600 g', 'chicken thighs, skinless'],
    ['2', 'chipotle peppers in adobo'],
    ['400 g', 'tinned tomatoes'],
    ['1', 'small onion, sliced'],
    ['3 cloves', 'garlic'],
    ['1 tsp', 'smoked paprika'],
    ['8', 'corn tortillas'],
    ['1', 'lime, in wedges'],
    ['', 'coriander and sour cream, to serve'],
  ] as [string, string][],
  cookware: ['Large lidded pan', 'Blender', 'Dry frying pan'],
  steps: [
    'Blend the chipotles, tomatoes, garlic and paprika until smooth.',
    'Soften the onion in a little oil in a large lidded pan, then add the sauce and the chicken thighs.',
    'Cover and simmer gently for 25 minutes, until the chicken pulls apart with a fork.',
    'Shred the chicken in the sauce and season well with salt and a squeeze of lime.',
    'Warm the tortillas in a dry pan for 30 seconds a side.',
    'Fill with chicken, top with coriander and sour cream, and serve with lime wedges.',
  ],
};
