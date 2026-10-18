/**
 * @packageDocumentation
 *
 * Small text helpers for the landing page's pictures of a recipe file: the file
 * name a title would be saved under, and which lines of a Cooklang source are
 * worth showing in a short preview.
 */

/** Metadata lines a preview leaves out because they say nothing to a newcomer. */
const HIDDEN_KEYS = ['>> images', '>> keywords', '>> favourite'];

/**
 * The file name stem a recipe title becomes: lower case, words joined by
 * hyphens, cut to `max` characters with no hyphen left dangling at either end.
 */
export function fileSlug(title: string, max = 30): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, max)
    .replace(/-$/, '');
}

/**
 * One line made ready to show: a metadata unit joined with `%` reads the way a
 * person writes it ("35%minutes" becomes "35 minutes"), and a line too long
 * for the preview is cut with an ellipsis.
 */
export function tidyLine(line: string): string {
  const clean = line.startsWith('>>') ? line.replace('%', ' ') : line;
  return clean.length > 92 ? `${clean.slice(0, 90)}…` : clean;
}

/**
 * The lines of a Cooklang source a preview should show: the first `max` that
 * are not blank and not machine-only metadata (cover images, keywords, the
 * favourite flag).
 */
export function previewLines(source: string, max: number): string[] {
  return source
    .split('\n')
    .filter(
      (line) => line.trim() && !HIDDEN_KEYS.some((key) => line.startsWith(key)),
    )
    .slice(0, max);
}
