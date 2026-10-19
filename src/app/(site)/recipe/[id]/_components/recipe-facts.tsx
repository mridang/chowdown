import type { ReactNode } from 'react';

import {
  ClockIcon,
  GlobeIcon,
  LeafIcon,
  OvenIcon,
  PlateIcon,
  ProteinIcon,
  ServingsIcon,
  ShieldIcon,
} from '@/components/icons';
import { Fact } from '@/components/recipe/fact';
import { Difficulty } from '@/components/ui/difficulty';
import { duration, sentenceCase } from '@/lib/format';
import { firstTag } from '@/lib/recipe/first-tag';
import type { RecipeTags } from '@/lib/recipe/tag-index';

/** One entry of the facts grid, ready to hand to `Fact`. */
export interface FactItem {
  /** What the fact is, e.g. "Total time". Unique in the list, so it is the key. */
  label: string;
  icon: ReactNode;
  value: ReactNode;
}

/**
 * The facts a recipe actually has, in display order. A fact the recipe lacks is
 * left out (rather than shown blank), so a bare recipe yields an empty list and
 * the grid is not drawn at all.
 */
export function buildFacts({
  minutes,
  serves,
  tags,
}: {
  /** Total time in minutes, when the recipe says. */
  minutes?: number;
  /** The servings the recipe declares, when it does. */
  serves?: number;
  tags: RecipeTags;
}): FactItem[] {
  const difficulty = firstTag(tags, 'difficulty');
  const protein = firstTag(tags, 'protein');
  const cuisine = firstTag(tags, 'cuisine');
  const course = firstTag(tags, 'category');
  const eatingStyle = firstTag(tags, 'diet_type');
  const methods = tags['method'] ?? [];
  const diet = tags['diet'] ?? [];

  const facts: FactItem[] = [];
  if (minutes !== undefined) {
    facts.push({
      label: 'Total time',
      icon: <ClockIcon size="lg" />,
      value: duration(minutes),
    });
  }
  if (serves !== undefined) {
    facts.push({
      label: 'Serves',
      icon: <ServingsIcon size="lg" />,
      value: serves,
    });
  }
  if (difficulty) {
    facts.push({
      label: 'Difficulty',
      icon: (
        <Difficulty
          level={difficulty}
          showLabel={false}
          className="scale-125"
        />
      ),
      value: difficulty,
    });
  }
  if (protein) {
    facts.push({
      label: 'Protein',
      icon: <ProteinIcon size="lg" protein={protein} />,
      value: sentenceCase(protein),
    });
  }
  if (cuisine) {
    facts.push({
      label: 'Cuisine',
      icon: <GlobeIcon size="lg" />,
      value: sentenceCase(cuisine),
    });
  }
  if (course) {
    facts.push({
      label: 'Course',
      icon: <PlateIcon size="lg" />,
      value: sentenceCase(course),
    });
  }
  if (methods.length > 0) {
    facts.push({
      label: 'Method',
      icon: <OvenIcon size="lg" />,
      value: methods.map((method) => sentenceCase(method)).join(', '),
    });
  }
  if (eatingStyle) {
    facts.push({
      label: 'Eating style',
      icon: <LeafIcon size="lg" />,
      value: eatingStyle,
    });
  }
  if (diet.length > 0) {
    facts.push({
      label: 'Diet',
      icon: <ShieldIcon size="lg" />,
      value: diet.join(', '),
    });
  }
  return facts;
}

/**
 * The grid of facts under the hero (time, servings, difficulty, protein,
 * cuisine and so on). Draws nothing when the recipe has no facts to show.
 */
export function RecipeFacts({ facts }: { facts: FactItem[] }) {
  if (facts.length === 0) {
    return null;
  }
  return (
    <dl className="mt-10 grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
      {facts.map((fact) => (
        <Fact key={fact.label} icon={fact.icon} label={fact.label}>
          {fact.value}
        </Fact>
      ))}
    </dl>
  );
}
