import { CoverImage } from '@/components/cover-image';
import type { RecipeMedia } from '@/lib/recipe/media';

/**
 * The recipe media gallery: a large cover image, a row of any additional
 * images, and a link to the video when present. Images are hotlinked from the
 * source for now; `referrerPolicy="no-referrer"` keeps a working image even
 * when the origin would otherwise block hotlinking, and `loading="lazy"` avoids
 * blocking the page on them. Renders nothing when there's no media.
 */
export function RecipeGallery({ media }: { media: RecipeMedia }) {
  if (!media.cover && media.rest.length === 0 && !media.video) {
    return null;
  }
  return (
    <div className="mt-6">
      {media.cover ? (
        <CoverImage
          src={media.cover}
          alt="Recipe"
          className="max-h-96 w-full rounded-xl object-cover"
          fallback={null}
        />
      ) : null}

      {media.rest.length > 0 ? (
        <div className="mt-2 flex gap-2 overflow-x-auto">
          {media.rest.map((src, i) => (
            <CoverImage
              key={i}
              src={src}
              alt="Recipe step"
              className="h-24 w-24 flex-none rounded-lg object-cover"
              fallback={null}
            />
          ))}
        </div>
      ) : null}

      {media.video ? (
        <a
          href={media.video}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 hover:text-amber-800"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="h-4 w-4"
            fill="currentColor"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
          Watch the video
        </a>
      ) : null}
    </div>
  );
}
