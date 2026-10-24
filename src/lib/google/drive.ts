/**
 * @packageDocumentation
 *
 * A thin Google Drive v3 REST client scoped to what chowdown needs: find or
 * create the user's "Recipes" folder, list the `.cook` files in it, read and
 * write file contents. Every call takes a bearer access token: the user's
 * `drive.file` token, for creating and editing the files the app owns.
 *
 * Under `drive.file` the app only ever sees files it created or the user
 * opened through it, so `ensureRecipesFolder` creating the folder is what makes
 * the whole folder listable with the user's own token.
 */

/** Base address of the Drive metadata API. */
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
/** Base address of the Drive upload API. */
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
/** The media type Drive gives folders. */
const FOLDER_MIME = 'application/vnd.google-apps.folder';
/** The media type recipe files are stored under (Drive has no Cooklang type). */
const COOK_MIME = 'text/plain';

/** Name of the app-managed folder created in each user's Drive. */
export const RECIPES_FOLDER_NAME = 'Recipes';

/** A Drive file as chowdown cares about it. */
export interface DriveFile {
  readonly id: string;
  readonly name: string;
  readonly modifiedTime?: string;
}

/**
 * Whether `id` looks like a Drive file id: letters, digits, `_` and `-` only.
 * Checked before an id from a URL is used in a query.
 */
export function isDriveFileId(id: string): boolean {
  return /^[\w-]+$/.test(id);
}

/** Whether a value is a file entry Drive returned (it has an id and a name). */
function isDriveFile(value: unknown): value is DriveFile {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'id') === 'string' &&
    typeof Reflect.get(value, 'name') === 'string'
  );
}

/** The well-formed file entries of a Drive listing answer (anything else is skipped). */
function filesOf(listing: unknown): readonly DriveFile[] {
  const files: unknown =
    typeof listing === 'object' && listing !== null
      ? Reflect.get(listing, 'files')
      : undefined;
  return Array.isArray(files) ? files.filter(isDriveFile) : [];
}

/** The token for the next page of a Drive listing answer, if there is one. */
function nextPageTokenOf(listing: unknown): string | undefined {
  const token: unknown =
    typeof listing === 'object' && listing !== null
      ? Reflect.get(listing, 'nextPageToken')
      : undefined;
  return typeof token === 'string' && token ? token : undefined;
}

/** GET against the Drive API with a bearer token; throws on a non-2xx. */
async function driveGet(path: string, accessToken: string): Promise<Response> {
  const response = await fetch(`${DRIVE_API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(
      `Drive GET ${path} -> ${response.status} ${await response.text()}`,
    );
  }
  return response;
}

/**
 * Find the app-managed "Recipes" folder, creating it if absent. Returns the
 * folder id. Only folders this app created are visible under `drive.file`, so
 * a hit here is always *our* folder, never an unrelated one the user owns.
 */
export async function ensureRecipesFolder(
  accessToken: string,
): Promise<string> {
  const q = `name='${RECIPES_FOLDER_NAME}' and mimeType='${FOLDER_MIME}' and trashed=false`;
  const params = new URLSearchParams({
    q,
    fields: 'files(id,name)',
    spaces: 'drive',
  });
  const found = filesOf(
    await (await driveGet(`/files?${params}`, accessToken)).json(),
  );
  const existing = found.at(0);
  if (existing) {
    return existing.id;
  }
  const response = await fetch(`${DRIVE_API}/files?fields=id`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: RECIPES_FOLDER_NAME, mimeType: FOLDER_MIME }),
  });
  if (!response.ok) {
    throw new Error(
      `Create folder failed: ${response.status} ${await response.text()}`,
    );
  }
  const created: unknown = await response.json();
  const id =
    typeof created === 'object' && created !== null
      ? Reflect.get(created, 'id')
      : undefined;
  if (typeof id !== 'string') {
    throw new Error('Create folder failed: no folder id in the answer');
  }
  return id;
}

/** The most listing pages read for one folder (1000 files each). */
const MAX_LIST_PAGES = 20;

/**
 * List the `.cook` files directly inside a folder, modification times
 * included. Follows Drive's paging, so a folder of more than a thousand files
 * is read in full: a listing that stopped short would look like deletions.
 */
export async function listRecipeFiles(
  folderId: string,
  accessToken: string,
): Promise<readonly DriveFile[]> {
  const found = await listPages(
    `'${folderId}' in parents and trashed=false`,
    accessToken,
  );
  return found.filter((f) => f.name.toLowerCase().endsWith('.cook'));
}

/**
 * Every file matching the Drive query `q`, reading page after page (up to
 * {@link MAX_LIST_PAGES}) until Drive says there are no more.
 */
async function listPages(
  q: string,
  accessToken: string,
  pageToken?: string,
  page = 0,
): Promise<readonly DriveFile[]> {
  const params = new URLSearchParams({
    q,
    fields: 'nextPageToken,files(id,name,modifiedTime)',
    pageSize: '1000',
    orderBy: 'name',
    ...(pageToken ? { pageToken } : {}),
  });
  const data: unknown = await (
    await driveGet(`/files?${params}`, accessToken)
  ).json();
  const next = nextPageTokenOf(data);
  return next && page + 1 < MAX_LIST_PAGES
    ? [...filesOf(data), ...(await listPages(q, accessToken, next, page + 1))]
    : filesOf(data);
}

/** Read a file's raw text content by id. */
export async function getFileContent(
  fileId: string,
  accessToken: string,
): Promise<string> {
  return (await driveGet(`/files/${fileId}?alt=media`, accessToken)).text();
}

/** Create a `.cook` file in a folder via multipart upload. Returns the new file. */
export async function createRecipeFile(
  folderId: string,
  name: string,
  content: string,
  accessToken: string,
): Promise<DriveFile> {
  const filename = name.toLowerCase().endsWith('.cook') ? name : `${name}.cook`;
  // Random, so recipe text can never contain it and cut the upload short.
  const boundary = `chowdown-${crypto.randomUUID()}`;
  const metadata = { name: filename, mimeType: COOK_MIME, parents: [folderId] };
  const body =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    'Content-Type: text/plain; charset=UTF-8\r\n\r\n' +
    `${content}\r\n` +
    `--${boundary}--`;
  const response = await fetch(
    `${DRIVE_UPLOAD}/files?uploadType=multipart&fields=id,name,modifiedTime`,
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
    throw new Error(
      `Create file failed: ${response.status} ${await response.text()}`,
    );
  }
  const created: unknown = await response.json();
  if (!isDriveFile(created)) {
    throw new Error('Create file failed: no file in the answer');
  }
  return created;
}

/** Overwrite a file's content via a media upload (PATCH). */
export async function updateRecipeFile(
  fileId: string,
  content: string,
  accessToken: string,
): Promise<void> {
  const response = await fetch(
    `${DRIVE_UPLOAD}/files/${fileId}?uploadType=media&fields=id`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'text/plain; charset=UTF-8',
      },
      body: content,
    },
  );
  if (!response.ok) {
    throw new Error(
      `Update file failed: ${response.status} ${await response.text()}`,
    );
  }
}

/**
 * Move a file to the Drive trash (not a permanent delete, so the user can still
 * restore it from Drive for ~30 days). Returns `'missing'` if the file is
 * already gone, so deleting twice is harmless; any other failure throws.
 */
export async function trashRecipeFile(
  fileId: string,
  accessToken: string,
): Promise<'trashed' | 'missing'> {
  const response = await fetch(`${DRIVE_API}/files/${fileId}?fields=id`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ trashed: true }),
  });
  if (response.status === 404) {
    return 'missing';
  }
  if (!response.ok) {
    throw new Error(
      `Trash file failed: ${response.status} ${await response.text()}`,
    );
  }
  return 'trashed';
}
