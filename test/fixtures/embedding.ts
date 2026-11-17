import type { EmbeddingRow } from '@/domain/db/embeddings';

/** A complete embedding row; a test names only the columns it cares about. */
export const anEmbedding = (
  overrides: Partial<EmbeddingRow> = {},
): EmbeddingRow => ({
  user_id: 1,
  drive_file_id: 'file-1',
  title: 'Recipe',
  modified_time: null,
  vector: '[]',
  similar: null,
  ...overrides,
});
