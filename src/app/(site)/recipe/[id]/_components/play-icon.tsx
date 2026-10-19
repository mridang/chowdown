/**
 * A small filled "play" triangle, for the link that opens the recipe's video.
 * Kept beside the recipe page because nothing else draws one (the shared icon
 * set is line icons only). Decorative: the link's text carries the meaning.
 */
export function PlayIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4"
      fill="currentColor"
    >
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
