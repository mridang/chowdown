/**
 * @packageDocumentation
 *
 * chowdown's recipe files in Drive, over the generic {@link DriveClient}: the
 * files are Cooklang (`.cook`, stored as `text/plain` since Drive has no
 * Cooklang type), and listing a folder keeps only those. This is where the
 * app's `.cook` convention lives, so the Drive client itself stays generic.
 */

import { DriveClient, type DriveFile } from '@/lib/google';

/** The media type recipe files are stored under (Drive has no Cooklang type). */
const COOK_MIME = 'text/plain';

/** List the `.cook` files directly inside a folder, modification times included. */
export async function listRecipeFiles(
  folderId: string,
  accessToken: string,
): Promise<readonly DriveFile[]> {
  const files = await new DriveClient(accessToken).listFiles(folderId);
  return files.filter((f) => f.name.toLowerCase().endsWith('.cook'));
}

/** Read a recipe file's raw Cooklang text by id. */
export async function getFileContent(
  fileId: string,
  accessToken: string,
): Promise<string> {
  return new DriveClient(accessToken).getContent(fileId);
}

/** Create a `.cook` file in a folder. Returns the new file. */
export async function createRecipeFile(
  folderId: string,
  name: string,
  content: string,
  accessToken: string,
): Promise<DriveFile> {
  const filename = name.toLowerCase().endsWith('.cook') ? name : `${name}.cook`;
  return new DriveClient(accessToken).createFile({
    parentId: folderId,
    name: filename,
    mimeType: COOK_MIME,
    content,
  });
}

/** Overwrite a recipe file's Cooklang content. */
export async function updateRecipeFile(
  fileId: string,
  content: string,
  accessToken: string,
): Promise<void> {
  return new DriveClient(accessToken).updateContent(fileId, content);
}

/** Move a recipe file to the Drive trash; `'missing'` if it is already gone. */
export async function trashRecipeFile(
  fileId: string,
  accessToken: string,
): Promise<'trashed' | 'missing'> {
  return new DriveClient(accessToken).trashFile(fileId);
}
