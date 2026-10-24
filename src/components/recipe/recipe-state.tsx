'use client';

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactElement,
  type ReactNode,
  type SetStateAction,
} from 'react';

import { displayQuantity, type UnitChoice } from '@/domain/recipe/page-view';

/** What the controls on a recipe page share. */
interface RecipeState {
  /** The number of people the amounts are scaled to. */
  readonly people: number;
  readonly setPeople: Dispatch<SetStateAction<number>>;
  /** The recipe's own units, or a measurement system to convert to. */
  readonly units: UnitChoice;
  readonly setUnits: (units: UnitChoice) => void;
  /** An amount as it should read right now: scaled, then converted. */
  readonly quantity: (quantity: string) => string;
}

/** Carries {@link RecipeState} down to the parts of the page that use it. */
const RecipeStateContext = createContext<RecipeState | null>(null);

/**
 * Holds the servings and units a visitor has chosen so the ingredient list, the
 * method's ingredient hints and cook mode all show the same amounts. Only the
 * state lives in this client component; the server-rendered page passes through
 * it as `children`.
 */
export function RecipeStateProvider({
  servings,
  initialUnits,
  children,
}: Readonly<{
  /** How many people the recipe is written for. */
  servings: number;
  initialUnits: UnitChoice;
  children: ReactNode;
}>): ReactElement {
  const [people, setPeople] = useState(servings);
  const [units, setUnits] = useState<UnitChoice>(initialUnits);
  const value = useMemo<RecipeState>(
    () => ({
      people,
      setPeople,
      units,
      setUnits,
      quantity: (quantity) =>
        displayQuantity(quantity, people / servings, units),
    }),
    [people, units, servings],
  );
  return (
    <RecipeStateContext.Provider value={value}>
      {children}
    </RecipeStateContext.Provider>
  );
}

/** The shared servings and units; must sit inside a {@link RecipeStateProvider}. */
export function useRecipeState(): RecipeState {
  const state = useContext(RecipeStateContext);
  if (!state) {
    throw new Error('useRecipeState needs a RecipeStateProvider');
  }
  return state;
}
