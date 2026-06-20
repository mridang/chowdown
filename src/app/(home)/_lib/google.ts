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

/** A file listed from a Drive folder. */
export interface DriveFile {
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

/**
 * Show the Picker in folder mode; resolve with the chosen folder, or null
 * if cancelled. Under `drive.file`, selecting a folder grants the app
 * access to that folder and the files inside it.
 */
export function pickFolder(accessToken: string): Promise<PickedFile | null> {
  return new Promise((resolve) => {
    const view = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
      .setSelectFolderEnabled(true)
      .setMimeTypes('application/vnd.google-apps.folder');

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

/** List the `.cook` files directly inside a Drive folder. */
export async function listFolderRecipes(
  folderId: string,
  accessToken: string,
): Promise<DriveFile[]> {
  const query = `'${folderId}' in parents and trashed = false`;
  const params = new URLSearchParams({
    q: query,
    fields: 'files(id,name)',
    pageSize: '200',
    orderBy: 'name',
  });
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!response.ok) {
    throw new Error(`Drive returned ${response.status}`);
  }
  const data = (await response.json()) as { files?: DriveFile[] };
  return (data.files ?? []).filter((file) => file.name.endsWith('.cook'));
}

/** Create a new `.cook` file inside a folder. Returns the created file. */
export async function createRecipe(
  folderId: string,
  name: string,
  content: string,
  accessToken: string,
): Promise<DriveFile> {
  const filename = name.endsWith('.cook') ? name : `${name}.cook`;
  const boundary = 'chowdown-boundary';
  const metadata = {
    name: filename,
    mimeType: 'text/plain',
    parents: [folderId],
  };
  const body =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    'Content-Type: text/plain; charset=UTF-8\r\n\r\n' +
    `${content}\r\n` +
    `--${boundary}--`;

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  if (!response.ok) {
    throw new Error(`Drive returned ${response.status}`);
  }
  return (await response.json()) as DriveFile;
}
