/**
 * @packageDocumentation
 *
 * How a View decides between its compact (inline) and expanded (fullscreen)
 * layouts. The MCP Apps spec puts three duties on a View: declare every mode it
 * supports, check that the host offers a mode before asking for it, and cope
 * when the host answers with a different mode than the one requested (or later
 * changes the mode on its own, for example when the person closes fullscreen
 * from the host's own header). Everything here is plain data in and data out,
 * so the rules can be tested without a browser; the hook in
 * `use-widget-data.ts` wires them to the real host.
 */

/** A way the host can present a View. */
export type DisplayMode = 'inline' | 'fullscreen' | 'pip';

/**
 * Every display mode the chowdown Views know how to lay out. Declared to the
 * host in `appCapabilities.availableDisplayModes` during `ui/initialize` and,
 * for ChatGPT, mirrored in the resource's `openai/ui` metadata.
 */
export const SUPPORTED_DISPLAY_MODES = ['inline', 'fullscreen'] as const;

/** The parts of the host context that matter for choosing a display mode. */
export interface DisplayModeHostContext {
  /** The mode the View is in right now, as far as the host has said. */
  readonly displayMode?: string;
  /** The modes the host can present Views in, when it says. */
  readonly availableDisplayModes?: readonly string[];
}

/** Whether the value is one of the three modes the spec defines. */
export function isDisplayMode(value: unknown): value is DisplayMode {
  return value === 'inline' || value === 'fullscreen' || value === 'pip';
}

/**
 * Whether a View may ask the host for `mode`. A host that publishes its list of
 * modes is believed (so we never ask for one it does not offer); a host that
 * publishes no list is given the benefit of the doubt, because the spec lets a
 * host omit the field and the host will refuse an unsupported request anyway.
 */
export function hostOffersMode(
  context: DisplayModeHostContext | undefined,
  mode: DisplayMode,
): boolean {
  const offered = context?.availableDisplayModes;
  return offered === undefined || offered.includes(mode);
}

/**
 * How to go about showing the expanded layout: `request` asks the host for real
 * fullscreen; `local` expands in place (the host has said it has no fullscreen,
 * so the View grows within its frame and shows its own way back).
 */
export type ExpandPlan = 'request' | 'local';

/** Decide how to expand, given what the host has said it offers. */
export function planExpand(
  context: DisplayModeHostContext | undefined,
): ExpandPlan {
  return hostOffersMode(context, 'fullscreen') ? 'request' : 'local';
}

/**
 * The layout a View is in. `hostMode` is what the host says; `expandedLocally`
 * is the View's own in-place expansion, used when the host declines fullscreen.
 */
export interface LayoutState {
  readonly hostMode: DisplayMode;
  readonly expandedLocally: boolean;
}

/** The layout a View starts in: inline, as hosts always begin. */
export const INITIAL_LAYOUT: LayoutState = {
  hostMode: 'inline',
  expandedLocally: false,
};

/** Something that can change the layout. */
export type LayoutAction =
  | {
      /** The host reported (or answered with) a display mode. */
      readonly type: 'host-mode';
      readonly mode: DisplayMode;
    }
  | {
      /** The View expands in place because the host would not go fullscreen. */
      readonly type: 'expand-locally';
    }
  | {
      /** The View collapses its own in-place expansion. */
      readonly type: 'collapse-locally';
    };

/**
 * The next layout. When the host leaves fullscreen (for example the person
 * closes it from the host header) any in-place expansion is dropped too, so a
 * View can never be left stuck in its expanded layout. A host that merely
 * repeats the mode it already reported changes nothing.
 */
export function reduceLayout(
  state: LayoutState,
  action: LayoutAction,
): LayoutState {
  switch (action.type) {
    case 'host-mode': {
      const leftFullscreen =
        state.hostMode === 'fullscreen' && action.mode !== 'fullscreen';
      return {
        hostMode: action.mode,
        expandedLocally: leftFullscreen ? false : state.expandedLocally,
      };
    }
    case 'expand-locally':
      return { ...state, expandedLocally: true };
    case 'collapse-locally':
      return { ...state, expandedLocally: false };
  }
}

/** Whether the expanded layout should be showing. */
export function isExpanded(state: LayoutState): boolean {
  return state.hostMode === 'fullscreen' || state.expandedLocally;
}

/**
 * The mode a host's answer to `ui/request-display-mode` reports, or undefined
 * when the answer is not a recognisable mode.
 */
export function modeFromResult(result: unknown): DisplayMode | undefined {
  if (typeof result !== 'object' || result === null) {
    return undefined;
  }
  const mode: unknown = Reflect.get(result, 'mode');
  return isDisplayMode(mode) ? mode : undefined;
}
