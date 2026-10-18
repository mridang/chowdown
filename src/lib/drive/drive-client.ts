/**
 * @packageDocumentation
 *
 * A thin Google Drive v3 REST client scoped to what chowdown needs: find or
 * create the user's "Recipes" folder, list the `.cook` files in it, read and
 * write file contents. Every call takes a bearer access token, so the same
 * code serves both auth modes — a user's `drive.file` token (for creating and
 * editing the files the app owns) and, later, the service-account token (for
 * reading everything in the shared folder).
 *
 * Under `drive.file` the app only ever sees files it created or the user
 * opened through it, so `ensureRecipesFolder` creating the folder is what makes
 * the whole folder listable with the user's own token.
 */

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const COOK_MIME = 'text/plain';

/** Name of the app-managed folder created in each user's Drive. */
export const RECIPES_FOLDER_NAME = 'Recipes';

/** A Drive file as chowdown cares about it. */
export interface DriveFile {
  id: string;
  name: string;
  modifiedTime?: string;
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
  const found = (await (
    await driveGet(`/files?${params}`, accessToken)
  ).json()) as {
    files?: DriveFile[];
  };
  if (found.files && found.files.length > 0) {
    return found.files[0]!.id;
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
  return ((await response.json()) as { id: string }).id;
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
): Promise<DriveFile[]> {
  const q = `'${folderId}' in parents and trashed=false`;
  const found: DriveFile[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_LIST_PAGES; page++) {
    const params = new URLSearchParams({
      q,
      fields: 'nextPageToken,files(id,name,modifiedTime)',
      pageSize: '1000',
      orderBy: 'name',
    });
    if (pageToken) {
      params.set('pageToken', pageToken);
    }
    const data = (await (
      await driveGet(`/files?${params}`, accessToken)
    ).json()) as { files?: DriveFile[]; nextPageToken?: string };
    found.push(...(data.files ?? []));
    pageToken = data.nextPageToken;
    if (!pageToken) {
      break;
    }
  }
  return found.filter((f) => f.name.toLowerCase().endsWith('.cook'));
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
  return (await response.json()) as DriveFile;
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
