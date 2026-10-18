/**
 * @packageDocumentation
 *
 * Made-up recipes for the public landing page. A visitor has not signed in, so
 * the page must never show the owner's saved recipes or hotlink photos from
 * other sites; these eight stand in for a collection, drawn as soft colour
 * tiles with no images. The first carries its Cooklang source, which the page
 * shows beside the finished recipe it produces.
 */

import type {
  CardRecipe,
  DifficultyLevel,
  Tone,
} from '@/lib/recipe/card-data';

export type { Tone };
/** A demo recipe is shaped like a saved one, but always has its facts. */
export type SampleRecipe = CardRecipe & {
  minutes: number;
  servings: number;
  difficulty: DifficultyLevel;
};

type BaseRecipe = Omit<
  SampleRecipe,
  'category' | 'diet' | 'method' | 'keywords'
>;

const BASE: BaseRecipe[] = [
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
    tone: 'sand',
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
    tone: 'forest',
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
    tone: 'flame',
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
    tone: 'forest',
  },
];

/**
 * The Cooklang source of the first sample recipe. It is the real syntax
 * (`@ingredient{amount%unit}`, `#cookware{}`, `~{time%unit}`), and its numbers
 * match the recipe's own facts: four servings, 35 minutes.
 */
const TACOS_COOKLANG = `>> title: Smoky Chipotle Chicken Tacos
>> servings: 4
>> time: 35%minutes
>> cuisine: Mexican

Blend @chipotle peppers in adobo{2}, @tinned tomatoes{400%g}, @garlic{3%cloves} and @smoked paprika{1%tsp} until smooth.

Soften @onion{1} in a #large lidded pan{}, then add the sauce and @chicken thighs{600%g}.

Cover and simmer for ~{25%minutes}, until the chicken pulls apart.

Warm @corn tortillas{8} in a #dry frying pan{}, fill, and serve with @lime{1}.
`;

/** The sample recipes the landing page draws. */
export const RECIPES: SampleRecipe[] = BASE.map((r, i) => ({
  ...r,
  category: 'Main',
  diet: [],
  method: ['Stovetop'],
  keywords: [],
  ...(i === 0 ? { cooklang: TACOS_COOKLANG } : {}),
}));
