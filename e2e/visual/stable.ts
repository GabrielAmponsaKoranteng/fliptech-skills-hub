// Makes pages look the same on every run, so screenshot differences mean the UI changed.
import { expect, type Page } from '@playwright/test';

/** The day the sample data is written around (see src/api/mock/bulk.ts), mid-morning. */
const NOW = new Date('2026-10-28T10:00:00');

/** A flat-coloured stand-in picture; the colour depends on the URL, so different photos stay distinguishable. */
function placeholder(url: string) {
  let h = 0;
  for (const ch of url.replace(/[?&]w=\d+/, '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = h % 360;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="hsl(${hue} 45% 70%)"/><rect x="40" y="40" width="320" height="220" fill="hsl(${hue} 45% 60%)"/></svg>`;
}

/**
 * Call before the first `goto`:
 * - freezes the clock, so greetings ("Good morning"), "2 hours ago" and date-based numbers don't move;
 * - swaps internet photos for placeholders and blocks web fonts and map tiles, so the network can't vary;
 * - loads every picture straight away, so nothing below the fold is still blank in a full-page shot.
 */
export async function stabilise(page: Page) {
  await page.clock.setFixedTime(NOW);
  await page.route('https://images.unsplash.com/**', (route) =>
    route.fulfill({ contentType: 'image/svg+xml', body: placeholder(route.request().url()) }));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.fulfill({ contentType: 'text/css', body: '' }));
  await page.route(/tile\.openstreetmap\.org/, (route) => route.abort());
  await page.addInitScript(() => {
    new MutationObserver(() => {
      for (const img of document.images) if (img.loading === 'lazy') img.loading = 'eager';
    }).observe(document, { childList: true, subtree: true });
  });
}

/** Waits until the page has settled: data loaded, no placeholders shimmering, every picture drawn. */
export async function settled(page: Page) {
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.skeleton, .loading-block')).toHaveCount(0);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
  // Fonts: the web font is blocked, so this resolves with the fallback font in place.
  await page.evaluate(() => document.fonts.ready);
}
