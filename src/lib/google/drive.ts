/**
 * @packageDocumentation
 *
 * A thin Google Drive v3 REST client: find or create a folder by name, list the
 * files in one, read and write file contents, and trash a file. It is built
 * with a bearer access token (the user's `drive.file` token, for the files the
 * app owns) and knows nothing about what the app stores — the "Recipes" folder
 * and `.cook` files are the domain's concern.
 *
 * Under `drive.file` the app only ever sees files it created or the user opened
 * through it, so {@link DriveClient.ensureFolder} creating the folder is what
 * makes the whole folder listable with the user's own token.
 */

/** Base address of the Drive metadata API. */
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
/** Base address of the Drive upload API. */
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
/** The media type Drive gives folders. */
const FOLDER_MIME = 'application/vnd.google-apps.folder';
/** The most listing pages read for one folder (1000 files each). */
const MAX_LIST_PAGES = 20;

/** A Drive file as callers care about it. */
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

/**
 * A Google Drive v3 client for one access token. Construct it per token (in
 * tests, with an injected `fetcher`) and use its methods; it holds no app or
 * domain knowledge.
 */
export class DriveClient {
  readonly #accessToken: string;
  readonly #fetch: typeof fetch;

  constructor(accessToken: string, fetcher?: typeof fetch) {
    this.#accessToken = accessToken;
    // Resolve the global fetch lazily so a test that swaps it still takes effect.
    this.#fetch = fetcher ?? ((input, init) => fetch(input, init));
  }

  get #auth(): string {
    return `Bearer ${this.#accessToken}`;
  }

  /** GET against the Drive API with the bearer token; throws on a non-2xx. */
  async #get(path: string): Promise<Response> {
    const response = await this.#fetch(`${DRIVE_API}${path}`, {
      headers: { Authorization: this.#auth },
    });
    if (!response.ok) {
      throw new Error(
        `Drive GET ${path} -> ${response.status} ${await response.text()}`,
      );
    }
    return response;
  }

  /**
   * Find a folder by name, creating it if absent. Returns the folder id. Only
   * folders this app created are visible under `drive.file`, so a hit is always
   * one of ours, never an unrelated folder the user owns.
   */
  async ensureFolder(name: string): Promise<string> {
    const q = `name='${name}' and mimeType='${FOLDER_MIME}' and trashed=false`;
    const params = new URLSearchParams({
      q,
      fields: 'files(id,name)',
      spaces: 'drive',
    });
    const found = filesOf(await (await this.#get(`/files?${params}`)).json());
    const existing = found.at(0);
    if (existing) {
      return existing.id;
    }
    const response = await this.#fetch(`${DRIVE_API}/files?fields=id`, {
      method: 'POST',
      headers: {
        Authorization: this.#auth,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, mimeType: FOLDER_MIME }),
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

  /**
   * List the files directly inside a folder, modification times included.
   * Follows Drive's paging, so a folder of more than a thousand files is read
   * in full: a listing that stopped short would look like deletions.
   */
  async listFiles(folderId: string): Promise<readonly DriveFile[]> {
    return this.#listPages(`'${folderId}' in parents and trashed=false`);
  }

  /**
   * Every file matching the Drive query `q`, reading page after page (up to
   * {@link MAX_LIST_PAGES}) until Drive says there are no more.
   */
  async #listPages(
    q: string,
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
    const data: unknown = await (await this.#get(`/files?${params}`)).json();
    const next = nextPageTokenOf(data);
    return next && page + 1 < MAX_LIST_PAGES
      ? [...filesOf(data), ...(await this.#listPages(q, next, page + 1))]
      : filesOf(data);
  }

  /** Read a file's raw text content by id. */
  async getContent(fileId: string): Promise<string> {
    return (await this.#get(`/files/${fileId}?alt=media`)).text();
  }

  /** Create a file in a folder via multipart upload. Returns the new file. */
  async createFile(
    params: Readonly<{
      parentId: string;
      name: string;
      mimeType: string;
      content: string;
    }>,
  ): Promise<DriveFile> {
    // Random, so file content can never contain it and cut the upload short.
    const boundary = `chowdown-${crypto.randomUUID()}`;
    const metadata = {
      name: params.name,
      mimeType: params.mimeType,
      parents: [params.parentId],
    };
    const body =
      `--${boundary}\r\n` +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${params.mimeType}; charset=UTF-8\r\n\r\n` +
      `${params.content}\r\n` +
      `--${boundary}--`;
    const response = await this.#fetch(
      `${DRIVE_UPLOAD}/files?uploadType=multipart&fields=id,name,modifiedTime`,
      {
        method: 'POST',
        headers: {
          Authorization: this.#auth,
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
  async updateContent(
    fileId: string,
    content: string,
    contentType = 'text/plain; charset=UTF-8',
  ): Promise<void> {
    const response = await this.#fetch(
      `${DRIVE_UPLOAD}/files/${fileId}?uploadType=media&fields=id`,
      {
        method: 'PATCH',
        headers: {
          Authorization: this.#auth,
          'Content-Type': contentType,
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
   * Move a file to the Drive trash (not a permanent delete, so the user can
   * still restore it from Drive for ~30 days). Returns `'missing'` if the file
   * is already gone, so deleting twice is harmless; any other failure throws.
   */
  async trashFile(fileId: string): Promise<'trashed' | 'missing'> {
    const response = await this.#fetch(
      `${DRIVE_API}/files/${fileId}?fields=id`,
      {
        method: 'PATCH',
        headers: {
          Authorization: this.#auth,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ trashed: true }),
      },
    );
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
}
