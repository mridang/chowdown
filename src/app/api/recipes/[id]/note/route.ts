/**
 * Add a personal note to a recipe.
 *
 *   POST /api/recipes/:id/note
 *     { text: string, ingredient?: string, step?: number } → { ok: true }
 *
 * Notes are additive Cooklang comments — the original method is never touched.
 * Attach a note to an ingredient (by name), a step (1-based number), or neither
 * for a general note.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getCurrentUser, getUserAccessToken } from '@/lib/auth/current-user';
import { appendNote, type Note } from '@/lib/recipe/cook-text';
import { getFileContent, updateRecipeFile } from '@/lib/drive/drive-client';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    text?: string;
    ingredient?: string;
    step?: number;
  } | null;
  const text = body?.text?.trim();
  if (!text) {
    return NextResponse.json({ error: 'text required' }, { status: 400 });
  }

  const ingredient = body?.ingredient?.trim();
  const scope: Note['scope'] = ingredient
    ? 'ingredient'
    : typeof body?.step === 'number'
      ? 'step'
      : 'general';
  const key =
    scope === 'ingredient'
      ? ingredient!
      : scope === 'step'
        ? String(body!.step)
        : '';

  const accessToken = await getUserAccessToken(user);
  try {
    const source = await getFileContent(id, accessToken);
    const updated = appendNote(source, { scope, key, text });
    await updateRecipeFile(id, updated, accessToken);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
}
