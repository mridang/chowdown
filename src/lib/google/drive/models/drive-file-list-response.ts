import { z } from 'zod';

import type { ApiModel } from '@/lib/http';

/** A single Drive file entry, as the metadata API returns it. @public */
export const DriveFileSchema = z.object({
  id: z.string(),
  name: z.string(),
  modifiedTime: z.string().optional(),
});
export type DriveFile = z.infer<typeof DriveFileSchema> & ApiModel;

/** A page of a Drive file listing, with the token for the next page if any. @public */
export const DriveFileListResponseSchema = z.object({
  files: z.array(DriveFileSchema).optional(),
  nextPageToken: z.string().optional(),
});
export type DriveFileListResponse = z.infer<
  typeof DriveFileListResponseSchema
> &
  ApiModel;
