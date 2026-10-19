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
