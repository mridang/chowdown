import type { ReactElement } from 'react';

/** A quiet note under the hero buttons about who it works with. */
export function WorksWith(): ReactElement {
  return (
    <p className="mt-5 flex flex-wrap items-center gap-2 text-sm text-muted">
      Works with Google Drive, ChatGPT and Claude.
    </p>
  );
}
