// The browser-tab title, meta description and link-preview (Open Graph) tags for the current page.
//
// Layouts set a default for each address (setRouteMeta); pages about one thing (a centre, a course,
// a product) override it with usePageMeta. The notification bell adds an unread count in front,
// e.g. "(2) Orders · Fliptech Skills Hub", and it survives navigation because everything goes through apply().
//
// Note: WhatsApp, Facebook and most other link-preview bots read the HTML the server sends and don't
// run this code, so they see the site-wide tags in index.html. Per-page previews need the server to
// put these tags in the HTML (see docs/API.md, "Link previews").
import { useEffect } from 'react';

export const SITE_NAME = 'Fliptech Skills Hub';
const HOME_TITLE = `${SITE_NAME} — Find. Learn. Create. Sell.`;

export interface PageMeta {
  /** Page name, without the site name; empty for the homepage */
  title?: string;
  description?: string;
  /** Absolute image URL for link previews */
  image?: string;
}

const initialDescription = typeof document !== 'undefined'
  ? document.querySelector('meta[name="description"]')?.getAttribute('content') ?? ''
  : '';

let routeMeta: PageMeta = {};
let pageMeta: PageMeta | null = null;
let unread = 0;

/** The title without the unread count, e.g. "Orders · Fliptech Skills Hub". */
export function currentTitle() {
  const title = pageMeta?.title ?? routeMeta.title;
  return title ? `${title} · ${SITE_NAME}` : HOME_TITLE;
}

function setTag(attr: 'name' | 'property', key: string, value: string | undefined) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!value) { el?.remove(); return; }
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
  el.content = value;
}

function apply() {
  const title = currentTitle();
  document.title = unread ? `(${unread > 9 ? '9+' : unread}) ${title}` : title;
  const description = pageMeta?.description ?? routeMeta.description ?? initialDescription;
  setTag('name', 'description', description);
  setTag('property', 'og:title', title);
  setTag('property', 'og:description', description);
  setTag('property', 'og:url', window.location.href);
  // Keep the site-wide image from index.html unless this page has its own.
  const image = pageMeta?.image ?? routeMeta.image;
  if (image) setTag('property', 'og:image', image);
}

/** The default for the current address; called by the layouts on every navigation. */
export function setRouteMeta(meta: PageMeta) {
  routeMeta = meta;
  apply();
}

/** Unread notifications, shown as "(n)" before the title. */
export function setUnreadCount(n: number) {
  unread = n;
  apply();
}

/** Overrides the title and description while the calling page is shown; pass null until its data is ready. */
export function usePageMeta(meta: PageMeta | null) {
  const key = meta ? JSON.stringify(meta) : '';
  useEffect(() => {
    if (!meta) return;
    pageMeta = meta;
    apply();
    return () => { pageMeta = null; apply(); };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
}
