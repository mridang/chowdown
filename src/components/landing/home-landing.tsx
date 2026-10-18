import { RECIPES } from '@/components/landing/demo-recipes';
import {
  Faq,
  FinalCta,
  Features,
  HeroVisual,
  SampleStrip,
  Facts,
  SignInButton,
  WorksWith,
} from '@/components/landing/landing';
import { ButtonLink } from '@/components/ui/button';
import { Container, Eyebrow, Heading } from '@/components/ui/layout';

/**
 * The signed-out home: what chowdown is, why, and a way in. A static server
 * component made only of made-up sample recipes, so it is safe to show anyone
 * and costs no data fetching or client script beyond the FAQ.
 */
export function HomeLanding() {
  const hero = RECIPES[0]!;
  return (
    <>
      <Container className="grid grid-cols-1 items-center gap-14 py-12 lg:grid-cols-[0.95fr_1.1fr] lg:gap-16 lg:py-20">
        <div>
          <Eyebrow>Recipes you actually keep</Eyebrow>
          <Heading as="h1" variant="display" className="mt-5">
            Your recipes.
            <br />
            <em className="text-ember">Your Drive.</em>
            <br />
            Your rules.
          </Heading>
          <p className="text-ink/75 mt-6 max-w-xl text-lg leading-relaxed">
            chowdown keeps every recipe as a plain text file in a folder you
            own, then makes them a pleasure to search, scale and cook from, and
            ready for your AI assistant.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <SignInButton />
            <ButtonLink href="#features" variant="outline" size="lg">
              See what it does
            </ButtonLink>
          </div>
          <WorksWith />
        </div>
        <div className="lg:pb-10">
          <HeroVisual recipe={hero} />
        </div>
      </Container>
      <SampleStrip recipes={RECIPES.slice(0, 6)} />
      <Facts />
      <Features recipes={RECIPES} />
      <Faq />
      <FinalCta />
    </>
  );
}
