import type { SampleRecipe } from '@/components/landing/demo-recipes';
import { AiVisual } from '@/components/landing/features/ai-visual';
import { CookVisual } from '@/components/landing/features/cook-visual';
import { Feature } from '@/components/landing/features/feature';
import { FilesVisual } from '@/components/landing/features/files-visual';
import { FiltersVisual } from '@/components/landing/features/filters-visual';
import { ImportVisual } from '@/components/landing/features/import-visual';
import { Container, Section } from '@/components/ui/layout';

/** The product's selling points, one picture each. */
export function Features({ recipes }: { recipes: SampleRecipe[] }) {
  // The import picture shows a link from a well-known site when there is one.
  const importer =
    recipes.find((recipe) => recipe.site === 'seriouseats.com') ?? recipes[0]!;
  // The cook-mode picture needs a recipe that has steps (a Cooklang source).
  const cook = recipes.find((recipe) => recipe.cooklang) ?? recipes[0]!;
  return (
    <Section id="features" surface="white">
      <Container className="flex flex-col gap-24 sm:gap-32">
        <Feature
          eyebrow="Yours to keep"
          title="Plain text, in your own Drive"
          body="Every recipe is a small readable file in a folder only you control. Open it in any editor, back it up, or take it elsewhere. There is nothing to export because nothing is locked in."
        >
          <FilesVisual recipes={recipes} />
        </Feature>
        <Feature
          flip
          eyebrow="Save from anywhere"
          title="Paste a link, get a recipe"
          body="Drop in a web address or a whole list of them. chowdown reads each page, tidies it up and tags it, and you check the draft before anything is saved."
        >
          <ImportVisual recipe={importer} />
        </Feature>
        <Feature
          eyebrow="Find dinner fast"
          title="Narrow it down in a click or two"
          body="Filter by difficulty, time, protein, cuisine and diet, and keep your favourites close. Easy and quick is two clicks away."
        >
          <FiltersVisual recipes={recipes} />
        </Feature>
        <Feature
          flip
          eyebrow="At the stove"
          title="Big steps, your units"
          body="Cook mode shows one large step at a time and keeps the screen awake. Scale the servings and switch between metric and US without doing sums."
        >
          <CookVisual recipe={cook} />
        </Feature>
        <Feature
          eyebrow="Bring your own AI"
          title="Ask your assistant about your recipes"
          body="Add one address to ChatGPT or Claude. It searches your collection, suggests dinner from what you have saved and files new recipes for you."
        >
          <AiVisual recipes={recipes} />
        </Feature>
      </Container>
    </Section>
  );
}
