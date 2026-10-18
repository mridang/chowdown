import { PageSkeleton } from '@/components/site/page-skeleton';

/**
 * Shown the instant one of these pages (Cook with AI, Add recipes) is chosen,
 * while its content loads. Because this boundary exists, Next can prefetch and
 * show this shell straight away on navigation instead of leaving the old page
 * frozen until the server answers. Pages with a more specific layout have their
 * own `loading.tsx`. It deliberately does NOT cover the home page or the privacy
 * policy: a boundary above them would put the page's text behind a skeleton in
 * the first HTML, hidden from anything that doesn't run scripts.
 */
export default function PagesLoading() {
  return <PageSkeleton />;
}
