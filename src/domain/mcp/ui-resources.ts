/**
 * @packageDocumentation
 *
 * The interactive views the MCP server offers next to its tools (the MCP Apps
 * extension): a recipe card and a recipe list, each a small page the assistant's
 * host shows in a frame. This module names them, says how they should be
 * framed and what they may load, and holds their HTML.
 *
 * Two things here are easy to get wrong, so they are spelled out:
 *
 * - Addresses carry a hash of the HTML. Hosts cache a view by its `ui://`
 *   address, so a view that changes must move to a new address; the hash makes
 *   that automatic. The old, hash-free addresses are still served so hosts and
 *   conversations that remember them keep working.
 * - The views load nothing from the network (no images, fonts, scripts or
 *   frames; the script is inline), so the declared Content-Security-Policy is
 *   empty. Declaring more would only widen what a host has to trust.
 */

import {
  SUPPORTED_DISPLAY_MODES,
  type DisplayMode,
} from '@/views/display-mode';
import {
  contentHash as recipeCardHash,
  html as recipeCardHtml,
} from '../../../dist/views/recipe-card';
import {
  contentHash as recipeListHash,
  html as recipeListHtml,
} from '../../../dist/views/recipe-list';
import { SITE_URL } from '@/utils/site';

/**
 * MIME type the MCP Apps spec requires for UI resources. Defined locally so the
 * Worker bundle stays lean (the ext-apps/server package pulls the Node SDK in);
 * a unit test asserts this equals the official `RESOURCE_MIME_TYPE` constant.
 */
export const RESOURCE_MIME_TYPE = 'text/html;profile=mcp-app';

/**
 * The flat tool-metadata key older MCP Apps hosts read instead of
 * `_meta.ui.resourceUri`. The spec marks it deprecated, but the official SDK
 * still writes both ("for compatibility with older hosts"), so we do too.
 */
export const LEGACY_RESOURCE_URI_META_KEY = 'ui/resourceUri';

/** How many hex characters of the content hash go into a view's address. */
const HASH_LENGTH_IN_URI = 12;

/**
 * The content-hashed `ui://` address of a view: stable while its HTML is
 * unchanged, different as soon as it changes.
 *
 * @param name - The view's file name stem, such as `recipe-card`.
 * @param contentHash - SHA-256 (hex) of the view's HTML, from the build step.
 */
export function hashedResourceUri(name: string, contentHash: string): string {
  return `ui://chowdown/${name}-${contentHash.slice(0, HASH_LENGTH_IN_URI)}.html`;
}

/** The address the recipe card was first published at, before addresses were hashed. */
export const LEGACY_CARD_RESOURCE_URI = 'ui://recipe/card.html';

/** The address the recipe list was first published at, before addresses were hashed. */
export const LEGACY_LIST_RESOURCE_URI = 'ui://recipe/list.html';

/**
 * The `ui://` address of the interactive recipe card View. Tool definitions
 * point at this, so a host fetches the new HTML whenever the View changes.
 */
export const CARD_RESOURCE_URI = hashedResourceUri(
  'recipe-card',
  recipeCardHash,
);

/**
 * The `ui://` address of the recipe list View. Tool definitions point at this,
 * so a host fetches the new HTML whenever the View changes.
 */
export const LIST_RESOURCE_URI = hashedResourceUri(
  'recipe-list',
  recipeListHash,
);

/**
 * Tool metadata that links a tool to its view: the standard `_meta.ui` form,
 * the deprecated flat key older hosts read, and ChatGPT's `openai/outputTemplate`
 * alias, all pointing at the same address.
 *
 * @param resourceUri - The view's `ui://` address.
 */
export function viewToolMeta(resourceUri: string): {
  readonly ui: { readonly resourceUri: string };
  readonly 'ui/resourceUri': string;
  readonly 'openai/outputTemplate': string;
} {
  return {
    ui: { resourceUri },
    [LEGACY_RESOURCE_URI_META_KEY]: resourceUri,
    'openai/outputTemplate': resourceUri,
  };
}

/** The origins a view needs to reach, by what it loads from them. */
export interface ViewOrigins {
  /** Origins for network requests (fetch, XHR, WebSocket). */
  readonly connect?: readonly string[];
  /** Origins for scripts, styles, images, fonts and media. */
  readonly resource?: readonly string[];
  /** Origins that may be embedded as nested frames. */
  readonly frame?: readonly string[];
  /** Origins allowed as the document's base URI. */
  readonly baseUri?: readonly string[];
}

/** The `_meta.ui.csp` object of the MCP Apps spec. */
export interface UiCsp {
  readonly connectDomains: readonly string[];
  readonly resourceDomains: readonly string[];
  readonly frameDomains?: readonly string[];
  readonly baseUriDomains?: readonly string[];
}

/** ChatGPT's older snake_case form of the same policy (`openai/widgetCSP`). */
export interface OpenAiWidgetCsp {
  readonly connect_domains: readonly string[];
  readonly resource_domains: readonly string[];
  readonly frame_domains?: readonly string[];
}

/**
 * Build the Content-Security-Policy declaration for a view, in both the
 * standard and ChatGPT forms. Connect and resource lists are always present
 * (hosts expect them); frame and base-URI lists appear only when non-empty,
 * since omitting them already means "none" and a present-but-empty frame list
 * can trip the extra review hosts apply to embedded frames.
 */
export function buildCsp(origins: ViewOrigins = {}): {
  readonly ui: UiCsp;
  readonly openai: OpenAiWidgetCsp;
} {
  const { connect = [], resource = [], frame = [], baseUri = [] } = origins;
  return {
    ui: {
      connectDomains: connect,
      resourceDomains: resource,
      ...(frame.length > 0 ? { frameDomains: frame } : {}),
      ...(baseUri.length > 0 ? { baseUriDomains: baseUri } : {}),
    },
    openai: {
      connect_domains: connect,
      resource_domains: resource,
      ...(frame.length > 0 ? { frame_domains: frame } : {}),
    },
  };
}

/**
 * The origin ChatGPT should run the views from (`openai/widgetDomain`): the
 * site's own address, the one place it is written down. This is the ChatGPT
 * form, an https origin. It is deliberately NOT repeated in the
 * standard `_meta.ui.domain`: that field is host-specific, Claude insists on
 * its own hash-based value there and refuses to render the view for any other,
 * and the views have no need of a dedicated origin (they make no requests).
 */
export const OPENAI_WIDGET_DOMAIN = SITE_URL;

/** What ChatGPT tells the model when a view appears, so it does not repeat the content. */
const WIDGET_DESCRIPTION =
  'A chowdown recipe view is now showing on screen. Do not repeat its contents; invite the person to look at it or ask for changes.';

/** The metadata a view's resource carries (on both its listing and its contents). */
export interface ViewResourceMeta {
  readonly ui: {
    readonly prefersBorder: boolean;
    readonly csp: UiCsp;
  };
  readonly 'openai/ui': {
    readonly availableDisplayModes: readonly DisplayMode[];
  };
  readonly 'openai/widgetPrefersBorder': boolean;
  readonly 'openai/widgetDomain': string;
  readonly 'openai/widgetDescription': string;
  readonly 'openai/widgetCSP': OpenAiWidgetCsp;
}

/**
 * Build the resource metadata for a view that loads from `origins`.
 *
 * The views draw their own card, so the host is asked not to add a second
 * border (`prefersBorder: false`).
 */
export function buildResourceMeta(origins: ViewOrigins = {}): ViewResourceMeta {
  const csp = buildCsp(origins);
  return {
    ui: { prefersBorder: false, csp: csp.ui },
    'openai/ui': { availableDisplayModes: SUPPORTED_DISPLAY_MODES },
    'openai/widgetPrefersBorder': false,
    'openai/widgetDomain': OPENAI_WIDGET_DOMAIN,
    'openai/widgetDescription': WIDGET_DESCRIPTION,
    'openai/widgetCSP': csp.openai,
  };
}

/**
 * Metadata shared by every view. The views load nothing external, so the
 * declared origins are empty (see the module comment).
 */
export const VIEW_RESOURCE_META: ViewResourceMeta = buildResourceMeta();

/** One view the server serves. */
export interface AppResource {
  /** The `ui://` address hosts read it at. */
  readonly uri: string;
  readonly name: string;
  readonly description: string;
  readonly html: string;
  /** Metadata for both `resources/list` and `resources/read`. */
  readonly meta: ViewResourceMeta;
  /**
   * True for the old hash-free addresses, served so that hosts and
   * conversations that cached them keep working. New tool definitions never
   * point at these.
   */
  readonly legacy: boolean;
  /**
   * True only for the content-hashed address the tool definitions point at:
   * the HTML behind it can never change, so a host may keep it for a long
   * time. False for the hash-free and stale addresses, whose content is
   * whatever the current build ships.
   */
  readonly immutable: boolean;
}

/** Fields shared by a view's current and legacy entries. */
interface ViewDescription {
  readonly name: string;
  readonly description: string;
  readonly html: string;
}

/** The two entries (current address first, then the legacy one) for a view. */
function entriesFor(
  view: ViewDescription,
  uri: string,
  legacyUri: string,
): readonly AppResource[] {
  return [
    { ...view, uri, meta: VIEW_RESOURCE_META, legacy: false, immutable: true },
    {
      ...view,
      uri: legacyUri,
      description: `${view.description} (older address, kept for compatibility)`,
      meta: VIEW_RESOURCE_META,
      legacy: true,
      immutable: false,
    },
  ];
}

/**
 * The app's UI resources, served via resources/list and resources/read: the
 * content-hashed addresses plus the legacy hash-free ones (flagged `legacy`).
 */
export const APP_RESOURCES: readonly AppResource[] = [
  ...entriesFor(
    {
      name: 'Recipe card',
      description: 'Interactive chowdown recipe card.',
      html: recipeCardHtml,
    },
    CARD_RESOURCE_URI,
    LEGACY_CARD_RESOURCE_URI,
  ),
  ...entriesFor(
    {
      name: 'Recipe list',
      description: 'The chowdown recipe list.',
      html: recipeListHtml,
    },
    LIST_RESOURCE_URI,
    LEGACY_LIST_RESOURCE_URI,
  ),
];

/**
 * What an older content-hashed address looks like: `ui://chowdown/<view>-` and
 * twelve hex digits. Every build that changes a view's HTML moves it to a new
 * address, but a host that stored the previous one in a conversation asks for
 * it again when it redraws that conversation.
 */
const HASHED_ADDRESS =
  /^ui:\/\/chowdown\/(recipe-card|recipe-list)-[0-9a-f]{12}\.html$/;

/**
 * The view served at `uri`: the current or legacy address, or any earlier
 * content-hashed address of the card or the list, which gets the current HTML
 * (answered under the address that was asked for, as the spec expects). The
 * data the Views draw is checked by a guard and degrades to a text message, so
 * an old card opened with new code is better than a blank frame. Undefined for
 * any other address.
 */
export function findAppResource(uri: string): AppResource | undefined {
  const exact = APP_RESOURCES.find((resource) => resource.uri === uri);
  if (exact !== undefined) {
    return exact;
  }
  const view = HASHED_ADDRESS.exec(uri)?.[1];
  if (view === undefined) {
    return undefined;
  }
  const current = APP_RESOURCES.find(
    (resource) =>
      !resource.legacy && resource.uri.startsWith(`ui://chowdown/${view}-`),
  );
  return current === undefined
    ? undefined
    : { ...current, uri, legacy: true, immutable: false };
}
