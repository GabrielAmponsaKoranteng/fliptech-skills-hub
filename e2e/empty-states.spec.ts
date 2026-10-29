import { expect, test, type Page } from '@playwright/test';
import { demoSignIn } from './helpers';

/** Starts the mock database with these tables emptied (only on the first page load, so changes stick). */
async function emptyTables(page: Page, tables: Record<string, unknown>) {
  await page.addInitScript((empty) => {
    if (sessionStorage.getItem('emptied')) return;
    sessionStorage.setItem('emptied', '1');
    for (const [k, v] of Object.entries(empty)) localStorage.setItem(`fsh.db.v3.${k}`, JSON.stringify(v));
  }, tables);
}

test('a centre with no activity gets guidance instead of blank cards', async ({ page }) => {
  await emptyTables(page, { enquiries: [], orders: [], views: {} });
  await demoSignIn(page, 'trainer');

  await expect(page.getByRole('heading', { name: 'No visits or enquiries yet' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'No orders yet' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Add a listing' })).toBeVisible();

  await page.getByRole('link', { name: 'Enquiries' }).first().click();
  await expect(page.getByRole('heading', { name: 'No enquiries yet' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your conversations will show here' })).toBeVisible();
});

test('the marketplace explains an empty shop and recovers from a search with no results', async ({ page }) => {
  await page.goto('/marketplace');
  const search = page.getByRole('searchbox', { name: 'Search' });
  await search.fill('no such thing anywhere');
  await expect(page.getByRole('heading', { name: 'Nothing matches' })).toBeVisible();
  await expect(page.getByText('No products match “no such thing anywhere”.')).toBeVisible();
  await page.getByRole('button', { name: 'Clear search and filters' }).click();
  await expect(search).toHaveValue('');
  await expect(page.getByText(/^\d+ results?$/)).not.toHaveText('0 results');
});

test('a marketplace with no listings says so', async ({ page }) => {
  await emptyTables(page, { products: [] });
  await page.goto('/marketplace');
  await expect(page.getByRole('heading', { name: 'No products yet' })).toBeVisible();
});

test('admin lists say why they are empty', async ({ page }) => {
  await emptyTables(page, { orders: [] });
  await demoSignIn(page, 'admin');
  await page.goto('/admin/orders');
  await expect(page.getByText('Orders from the marketplace will appear here as soon as buyers check out.')).toBeVisible();
});
