import type { Recipe } from '@/domain/db/recipes';

/** A complete recipe row; a test names only the columns it cares about. */
export const aRecipe = (overrides: Partial<Recipe> = {}): Recipe => ({
  id: 1,
  user_id: 1,
  drive_file_id: 'file-1',
  name: 'Recipe.cook',
  title: null,
  source: '',
  modified_time: null,
  parse_error: null,
  tags: null,
  source_url: null,
  embedded_at: null,
  images_indexed: 0,
  first_opened_at: '2026-01-01T00:00:00.000Z',
  last_opened_at: '2026-01-01T00:00:00.000Z',
  ...overrides,
});
