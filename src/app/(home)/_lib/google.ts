/**
 * @packageDocumentation
 *
 * Client-side glue for opening a file from Google Drive: load the GIS +
 * Picker scripts, get an access token with the `drive.file` scope, show
 * the Picker, and download the chosen file. All public config (client id,
 * api key) is exposed to the browser by design — it is locked down by the
 * OAuth client's authorized origins and the API key's referrer list, not
 * by secrecy. See README for the Google Cloud setup.
 */

/** The narrow Drive scope: access only to files opened through this app. */
const SCOPE = 'https://www.googleapis.com/auth/drive.file';

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const GAPI_SRC = 'https://apis.google.com/js/api.js';

/** Public Google config, injected at build time via `NEXT_PUBLIC_*`. */
export const GOOGLE_CONFIG = {
  clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '',
  apiKey: process.env.NEXT_PUBLIC_GOOGLE_API_KEY ?? '',
  appId: process.env.NEXT_PUBLIC_GOOGLE_APP_ID ?? '',
} as const;

/** True once both the client id and api key are present. */
export function isGoogleConfigured(): boolean {
  return Boolean(GOOGLE_CONFIG.clientId && GOOGLE_CONFIG.apiKey);
}

/** A file the user picked from Drive. */
export interface PickedFile {
  id: string;
  name: string;
}

const loaded = new Set<string>();

function loadScript(src: string): Promise<void> {
  if (loaded.has(src)) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => {
      loaded.add(src);
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

let pickerReady = false;

/** Ensure the GIS client and the Picker API are both loaded. */
export async function ensureGoogleLibs(): Promise<void> {
  await loadScript(GAPI_SRC);
  if (!pickerReady) {
    await new Promise<void>((resolve) => gapi.load('picker', () => resolve()));
    pickerReady = true;
  }
  await loadScript(GIS_SRC);
}

/** Prompt the user to sign in and resolve with a Drive access token. */
export function requestAccessToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CONFIG.clientId,
      scope: SCOPE,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response.access_token);
        }
      },
    });
    client.requestAccessToken({ prompt: '' });
  });
}

/** Show the Drive Picker; resolve with the picked file, or null if cancelled. */
export function openPicker(accessToken: string): Promise<PickedFile | null> {
  return new Promise((resolve) => {
    const view = new google.picker.DocsView(google.picker.ViewId.DOCS)
      .setMode(google.picker.DocsViewMode.LIST)
      .setIncludeFolders(true)
      .setSelectFolderEnabled(false);

    const builder = new google.picker.PickerBuilder()
      .setDeveloperKey(GOOGLE_CONFIG.apiKey)
      .setOAuthToken(accessToken)
      .addView(view)
      .setCallback((data) => {
        if (data.action === google.picker.Action.PICKED) {
          const doc = data.docs[0];
          resolve(doc ? { id: doc.id, name: doc.name } : null);
        } else if (data.action === google.picker.Action.CANCEL) {
          resolve(null);
        }
      });

    if (GOOGLE_CONFIG.appId) {
      builder.setAppId(GOOGLE_CONFIG.appId);
    }
    builder.build().setVisible(true);
  });
}

/** Download the raw contents of a Drive file by id. */
export async function fetchDriveFile(
  id: string,
  accessToken: string,
): Promise<string> {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${id}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!response.ok) {
    throw new Error(`Drive returned ${response.status}`);
  }
  return response.text();
}
