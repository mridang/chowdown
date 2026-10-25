/**
 * @packageDocumentation
 *
 * A thin Google Drive v3 client. The JSON listing reads go through
 * {@link JsonClient} and decode into {@link DriveFileListResponse}; reading,
 * creating and overwriting file content are raw or multipart uploads done as
 * direct fetches, since they are not JSON request/response calls. It is built
 * with a bearer access token (the user's `drive.file` token, for the files the
 * app owns) and knows nothing about what the app stores — the "Recipes" folder
 * and `.cook` files are the domain's concern.
 *
 * Under `drive.file` the app only ever sees files it created or the user opened
 * through it, so {@link DriveClient.ensureFolder} creating the folder is what
 * makes the whole folder listable with the user's own token.
 */

import { JsonClient } from '@/lib/http';

import {
  DriveFileListResponseSchema,
  DriveFileSchema,
  type DriveFile,
  type DriveFileListResponse,
} from './models';

/** Base address of the Drive metadata API. */
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
/** Base address of the Drive upload API. */
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
/** The media type Drive gives folders. */
const FOLDER_MIME = 'application/vnd.google-apps.folder';
/** The most listing pages read for one folder (1000 files each). */
const MAX_LIST_PAGES = 20;

/**
 * Whether `id` looks like a Drive file id: letters, digits, `_` and `-` only.
 * Checked before an id from a URL is used in a query.
 */
export function isDriveFileId(id: string): boolean {
  return /^[\w-]+$/.test(id);
}

/**
 * A Google Drive v3 client for one access token. Construct it per token (in
 * tests, with an injected `fetcher`) and use its methods; it holds no app or
 * domain knowledge.
 */
export class DriveClient {
  readonly #accessToken: string;
  readonly #fetch: typeof fetch;
  readonly #http: JsonClient;

  constructor(accessToken: string, fetcher?: typeof fetch) {
    this.#accessToken = accessToken;
    // Resolve the global fetch lazily so a test that swaps it still takes effect.
    this.#fetch = fetcher ?? ((input, init) => fetch(input, init));
    // Each listing read passes an absolute endpoint as the path, so base is empty.
    this.#http = new JsonClient('', this.#fetch);
  }

  get #auth(): string {
    return `Bearer ${this.#accessToken}`;
  }

  /** GET a JSON file listing from the Drive API; throws on a non-2xx or undecodable body. */
  async #list(
    query: Readonly<Record<string, string>>,
  ): Promise<DriveFileListResponse> {
    const result = await this.#http.request(
      {
        path: `${DRIVE_API}/files`,
        query,
        init: { headers: { Authorization: this.#auth } },
      },
      DriveFileListResponseSchema,
    );
    if (!result.ok) {
      throw new Error(`Drive list -> ${result.status ?? '?'} ${result.raw}`);
    }
    return result.value;
  }

  /**
   * Find a folder by name, creating it if absent. Returns the folder id. Only
   * folders this app created are visible under `drive.file`, so a hit is always
   * one of ours, never an unrelated folder the user owns.
   */
  async ensureFolder(name: string): Promise<string> {
    const listing = await this.#list({
      q: `name='${name}' and mimeType='${FOLDER_MIME}' and trashed=false`,
      fields: 'files(id,name)',
      spaces: 'drive',
    });
    const existing = listing.files?.at(0);
    if (existing) {
      return existing.id;
    }
    // Creating the folder is a direct JSON POST that answers with just its id.
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
    const listing = await this.#list({
      q,
      fields: 'nextPageToken,files(id,name,modifiedTime)',
      pageSize: '1000',
      orderBy: 'name',
      ...(pageToken ? { pageToken } : {}),
    });
    const files = listing.files ?? [];
    const next = listing.nextPageToken;
    return next && page + 1 < MAX_LIST_PAGES
      ? [...files, ...(await this.#listPages(q, next, page + 1))]
      : files;
  }

  /** Read a file's raw text content by id. A media download, done as a direct fetch. */
  async getContent(fileId: string): Promise<string> {
    const response = await this.#fetch(
      `${DRIVE_API}/files/${fileId}?alt=media`,
      {
        headers: { Authorization: this.#auth },
      },
    );
    if (!response.ok) {
      throw new Error(
        `Drive GET /files/${fileId} -> ${response.status} ${await response.text()}`,
      );
    }
    return response.text();
  }

  /**
   * Create a file in a folder via multipart upload. A direct fetch (not a JSON
   * request), whose JSON answer is decoded with {@link DriveFileSchema}.
   * Returns the new file.
   */
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
    const decoded = DriveFileSchema.safeParse(await response.json());
    if (!decoded.success) {
      throw new Error('Create file failed: no file in the answer');
    }
    return decoded.data;
  }

  /**
   * Overwrite a file's content via a media upload (PATCH). A direct fetch, not
   * a JSON request.
   */
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
