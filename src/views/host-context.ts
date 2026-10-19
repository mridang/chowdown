/**
 * @packageDocumentation
 *
 * Turning pieces of the host context into things a page can use: the safe-area
 * insets become CSS custom properties (so the layout keeps its controls out
 * from under a phone's notch or the chat composer), and the container
 * dimensions say whether the host fixes the frame's height. Pure functions;
 * the hook applies the results to the document.
 */

/** Pixel insets the host asks a View to keep clear of. */
export interface SafeAreaInsets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

/**
 * The CSS custom properties (name, value) for a set of safe-area insets. Values
 * that are not finite, non-negative numbers are treated as zero, because the
 * insets come from the host and are used inside CSS.
 */
export function safeAreaVariables(
  insets: SafeAreaInsets | undefined,
): readonly (readonly [string, string])[] {
  const px = (value: number | undefined): string =>
    `${typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0}px`;
  return [
    ['--safe-top', px(insets?.top)],
    ['--safe-right', px(insets?.right)],
    ['--safe-bottom', px(insets?.bottom)],
    ['--safe-left', px(insets?.left)],
  ];
}

/**
 * Whether the host fixes the height of the View's frame. A fixed frame should be
 * filled; a flexible one is sized by the View (which reports its size).
 */
export function hasFixedHeight(
  dimensions: Readonly<Record<string, unknown>> | undefined,
): boolean {
  return typeof dimensions?.['height'] === 'number';
}

/**
 * What a BCP 47 language tag looks like when it is only letters, digits and
 * hyphens in the usual groups (`en`, `pt-BR`, `zh-Hant-TW`). The tag comes from
 * the host and ends up in the document, so anything stranger is ignored.
 */
const LANGUAGE_TAG = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,4}$/;

/**
 * The value for the document's `lang` attribute from the host's locale, or
 * undefined when it is missing or not a plain language tag. Screen readers pick
 * the voice from `lang`, so it should follow the person's language, not the
 * English the page was written in. Underscores (`en_US`) are accepted because
 * some hosts send POSIX-style locales.
 */
export function localeToLang(locale: unknown): string | undefined {
  if (typeof locale !== 'string') {
    return undefined;
  }
  const tag = locale.trim().replaceAll('_', '-');
  return LANGUAGE_TAG.test(tag) ? tag : undefined;
}
