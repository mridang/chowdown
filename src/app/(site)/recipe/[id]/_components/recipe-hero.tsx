import type { ReactElement } from 'react';

import { PlayIcon } from '@/components/icons';
import { FavouriteButton } from '@/components/recipes/favourite-button';
import { CookMode } from '@/components/recipe/cook-mode';
import { HeroPhoto } from '@/components/recipe/hero-photo';
import { MoreMenu, ShareButton } from '@/components/recipe/actions';
import { Breadcrumb, type Crumb } from '@/components/ui/breadcrumb';
import { Eyebrow, Heading } from '@/components/ui/layout';
import { TextLink } from '@/components/ui/text-link';
import { sentenceCase } from '@/lib/format';
import type { Tone } from '@/lib/recipe/card-data';
import type { StepToken } from '@/lib/recipe/cooklang';

import { SourceLine } from './source-line';

/**
 * The trail above the title: always "Recipes", plus the recipe's cuisine (a
 * link to that cuisine's list) when it has one.
 */
export function heroCrumbs(cuisine: string | undefined): readonly Crumb[] {
  return [
    { label: 'Recipes', href: '/app' },
    ...(cuisine
      ? [
          {
            label: sentenceCase(cuisine),
            href: `/app?cuisine=${encodeURIComponent(cuisine)}`,
          },
        ]
      : []),
  ];
}

/**
 * The small line above the title: the cuisine and the course joined by a dot,
 * or `undefined` when the recipe has neither.
 */
export function heroEyebrow(
  cuisine: string | undefined,
  course: string | undefined,
): string | undefined {
  const words = [cuisine, course].filter((word): word is string =>
    Boolean(word),
  );
  return words.length > 0
    ? words.map((word) => sentenceCase(word)).join(' · ')
    : undefined;
}

/**
 * The top of the recipe page: a split hero with the title, source and actions
 * beside the photo (stacked, photo first, on phones).
 *
 * The text column must start exactly where the page container does, so the
 * title, the facts and the ingredients share one left edge. The photo bleeds to
 * the right edge, so the container gutter is rebuilt here from the section
 * width (cqw) rather than nested.
 */
export function RecipeHero({
  recipeId,
  title,
  images,
  tone,
  cuisine,
  course,
  sourceText,
  sourceUrl,
  video,
  steps,
  favourite,
}: Readonly<{
  recipeId: string;
  /** The title, already cleaned for display. */
  title: string;
  /** Photo addresses, the cover first (empty when the recipe has none). */
  images: readonly string[];
  tone: Tone;
  cuisine?: string;
  course?: string;
  /** The recipe's own "source" line, shown when it is not a web address. */
  sourceText?: string;
  /** The web address the recipe was saved from. */
  sourceUrl?: string;
  /** A video for the recipe, when it links one. */
  video?: string;
  steps: readonly (readonly StepToken[])[];
  favourite: boolean;
}>): ReactElement {
  const eyebrow = heroEyebrow(cuisine, course);
  return (
    <section className="border-line @container border-b print:border-0">
      <div className="grid grid-cols-1 lg:grid-cols-2 print:block">
        <HeroPhoto
          images={images}
          title={title}
          tone={tone}
          className="aspect-[16/10] lg:order-2 lg:aspect-auto lg:min-h-[32rem] print:hidden"
        />
        <div className="px-4 py-8 sm:px-6 lg:order-1 lg:py-14 lg:pr-16 lg:pl-[max(2.5rem,calc((100cqw-90rem)/2+2.5rem))]">
          <Breadcrumb crumbs={heroCrumbs(cuisine)} className="print:hidden" />
          {eyebrow ? <Eyebrow className="mt-5">{eyebrow}</Eyebrow> : null}
          <Heading as="h1" variant="h1" className="mt-3 lg:text-6xl">
            {title}
          </Heading>
          <SourceLine value={sourceText} url={sourceUrl} />
          {video ? (
            <TextLink
              href={video}
              external
              look="strong"
              className="mt-1 inline-flex h-8 items-center gap-1.5 text-sm print:hidden"
            >
              <PlayIcon size="sm" />
              Watch the video
            </TextLink>
          ) : null}
          <div className="mt-7 flex flex-wrap items-center gap-2.5 print:hidden">
            {steps.length > 0 ? <CookMode title={title} steps={steps} /> : null}
            <FavouriteButton
              recipeId={recipeId}
              initial={favourite}
              variant="labelled"
            />
            <ShareButton title={title} />
            <MoreMenu recipeId={recipeId} title={title} />
          </div>
        </div>
      </div>
    </section>
  );
}
