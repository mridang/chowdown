/** Static footer credit + link to the Cooklang spec. */
export function Footer() {
  return (
    <footer className="mt-12 border-t border-slate-200 pt-5 text-[12px] text-slate-400">
      chowdown · renders{' '}
      <a
        href="https://cooklang.org"
        className="underline hover:text-slate-600"
        target="_blank"
        rel="noreferrer"
      >
        Cooklang
      </a>{' '}
      recipe files from Google Drive
    </footer>
  );
}
