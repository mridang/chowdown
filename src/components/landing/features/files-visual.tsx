import { CookFile } from '@/components/landing/cook-file-view';
import { fileSlug } from '@/components/landing/cook-file';
import type { SampleRecipe } from '@/components/landing/demo-recipes';
import { WindowFrame } from '@/components/landing/window-frame';
import { cn } from '@/components/ui/cn';
import { TintTile } from '@/components/ui/tint-tile';

/** Your Drive: the folder of files, and the first one open beside it. */
export function FilesVisual({ recipes }: { recipes: SampleRecipe[] }) {
  const files = recipes.slice(0, 6);
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-[0.9fr_1.1fr]">
      <WindowFrame
        label="A Google Drive folder of recipe files"
        title="Drive / Recipes"
      >
        <ul className="p-2">
          {files.map((file, index) => (
            <li
              key={file.id}
              className={cn(
                'rounded-control flex items-center gap-3 px-3 py-2.5',
                // The first file is the one shown open, so it is highlighted.
                index === 0 && 'bg-marigold/25',
              )}
            >
              <TintTile
                tone={file.tone}
                className="h-8 w-8 shrink-0 rounded-[6px] [&>svg]:h-1/2 [&>svg]:w-1/2"
              />
              <span className="min-w-0 flex-1 truncate font-mono text-xs">
                {fileSlug(file.title)}.cook
              </span>
            </li>
          ))}
        </ul>
      </WindowFrame>
      <CookFile recipe={files[0]!} lines={9} />
    </div>
  );
}
