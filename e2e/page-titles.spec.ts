import { expect, test } from '@playwright/test';
import { demoSignIn } from './helpers';

test('every page has its own title', async ({ page }) => {
  const cases: [path: string, title: string][] = [
    ['/', 'Fliptech Skills Hub — Find. Learn. Create. Sell.'],
    ['/search', 'Find training providers · Fliptech Skills Hub'],
    ['/providers/accra-central-welding', 'Accra Central Welding Works, Accra Central · Fliptech Skills Hub'],
    ['/courses/c3', 'Welding Fundamentals – online course · Fliptech Skills Hub'],
    ['/marketplace/m9', 'Metal Fabrication Starter Toolkit · Fliptech Skills Hub'],
    ['/cart', 'Your cart · Fliptech Skills Hub'],
    ['/no-such-page', 'Page not found · Fliptech Skills Hub'],
    ['/providers/nope', 'Provider not found · Fliptech Skills Hub'],
  ];
  for (const [path, title] of cases) {
    await page.goto(path);
    await expect(page, path).toHaveTitle(title);
  }
});

test('the description and preview tags follow the page', async ({ page }) => {
  await page.goto('/providers/accra-central-welding');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /practical welding skills/);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /Accra Central Welding Works/);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /images\.unsplash\.com/);
});

test('dashboard titles name the section, and keep the unread count', async ({ page }) => {
  await demoSignIn(page, 'trainer');
  await expect(page).toHaveTitle(/^\(\d+\) Overview · Training centre · Fliptech Skills Hub$/);
  await page.getByRole('link', { name: /^Orders/ }).first().click();
  await expect(page).toHaveTitle(/^\(\d+\) Orders · Training centre · Fliptech Skills Hub$/);
});

test('moving between pages is announced to screen readers', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Marketplace' }).first().click();
  await expect(page.locator('[aria-live="polite"][aria-atomic="true"]')).toHaveText('Marketplace · Fliptech Skills Hub');
});
