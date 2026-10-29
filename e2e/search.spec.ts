import { expect, test } from '@playwright/test';
import { demoSignIn } from './helpers';

test.describe('provider search', () => {
  test('every word narrows the results, and the best match comes first', async ({ page }) => {
    await page.goto('/search');
    await page.getByLabel('Skill or provider').fill('welding tema');
    await page.getByLabel('Skill or provider').press('Enter');
    await expect(page).toHaveURL(/q=welding\+tema/);
    await expect(page.getByRole('heading', { name: '1 provider match your filters' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Tema Community Welding Centre/ }).first()).toBeVisible();
  });

  test('a dead end offers a spelling fix and a filter to drop', async ({ page }) => {
    await page.goto('/search?q=weldng&area=Kasoa');
    await expect(page.getByRole('heading', { name: 'No providers match' })).toBeVisible();
    await page.getByRole('button', { name: 'welding', exact: true }).click();
    await expect(page.getByLabel('Skill or provider')).toHaveValue('welding');

    // Still nothing in Kasoa, so the page offers to drop the area, saying how many that would show.
    const dropArea = page.getByRole('button', { name: /Remove Kasoa \(\d+\)/ });
    const count = Number((await dropArea.textContent())!.match(/\((\d+)\)/)![1]);
    await dropArea.click();
    await expect(page.getByRole('heading', { name: `${count} providers match your filters` })).toBeVisible();
  });

  test('searching for something only taught online points to the courses', async ({ page }) => {
    await page.goto('/search?q=catering');
    await expect(page.getByText(/1 online course matches “catering”/)).toBeVisible();
    await page.getByRole('button', { name: 'See courses' }).click();
    await expect(page).toHaveURL(/\/courses\?q=catering/);
    await expect(page.getByRole('link', { name: /Ghanaian Catering for Events/ }).first()).toBeVisible();
  });

  test('remembers the chosen view and recent searches on this device', async ({ page }) => {
    await page.goto('/search?q=hair');
    await page.getByRole('button', { name: 'Grid' }).click();
    await page.goto('/search');
    await expect(page.getByRole('button', { name: 'Grid' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('link', { name: '“hair”' }).click();
    await expect(page).toHaveURL(/q=hair/);
  });

  test('the map view still shows filters it has no room for', async ({ page }) => {
    await page.goto('/search?q=welding&area=Madina&view=map');
    await expect(page.getByRole('button', { name: 'Remove Madina' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '1 provider in Greater Accra' })).toBeVisible();
  });
});

test.describe('marketplace and courses', () => {
  test('search, category and sort survive opening an item and going back', async ({ page }) => {
    await page.goto('/marketplace');
    await page.getByRole('searchbox', { name: 'Search' }).fill('soap');
    await page.getByRole('combobox', { name: 'Sort' }).selectOption('low');
    await expect(page.getByText('2 results')).toBeVisible();
    await page.getByRole('link', { name: /Natural Herbal Soap/ }).first().click();
    await expect(page).toHaveURL(/\/marketplace\/m2/);

    await page.goBack();
    await expect(page.getByRole('searchbox', { name: 'Search' })).toHaveValue('soap');
    await expect(page.getByRole('combobox', { name: 'Sort' })).toHaveValue('low');
    await expect(page.getByText('2 results')).toBeVisible();
  });

  test('category chips show how many results each has', async ({ page }) => {
    await page.goto('/marketplace?q=beads');
    await expect(page.getByRole('button', { name: /Arts, Crafts & Accessories 2/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^All 2$/ })).toHaveAttribute('aria-pressed', 'true');
  });

  test('a course search with no results offers to include paid courses', async ({ page }) => {
    await page.goto('/courses?q=welding&free=1');
    await expect(page.getByRole('heading', { name: 'Nothing matches' })).toBeVisible();
    await page.getByRole('button', { name: /Include paid courses \(1\)/ }).click();
    await expect(page.getByRole('link', { name: /Welding Fundamentals/ }).first()).toBeVisible();
  });
});

test.describe('dashboard search box', () => {
  test('a trainee searches training from their dashboard', async ({ page }) => {
    await demoSignIn(page, 'trainee');
    await page.getByRole('searchbox', { name: 'Search training' }).fill('plumbing');
    await page.getByRole('searchbox', { name: 'Search training' }).press('Enter');
    await expect(page).toHaveURL(/\/search\?q=plumbing/);
  });

  test('a trainer finds an enquiry by name', async ({ page }) => {
    await demoSignIn(page, 'trainer');
    await page.getByRole('searchbox', { name: 'Search enquiries' }).fill('Esi Mensah');
    await page.getByRole('searchbox', { name: 'Search enquiries' }).press('Enter');
    await expect(page).toHaveURL(/\/trainer\/enquiries\?q=Esi/);
    await expect(page.locator('.inbox-item').first()).toContainText('Esi Mensah');
    await page.getByRole('button', { name: /Clear search/ }).click();
    await expect(page).toHaveURL(/\/trainer\/enquiries$/);
  });

  test('an admin jumps to a provider', async ({ page }) => {
    await demoSignIn(page, 'admin');
    await page.getByRole('searchbox', { name: 'Search providers' }).first().fill('kaneshie');
    await page.getByRole('searchbox', { name: 'Search providers' }).first().press('Enter');
    await expect(page).toHaveURL(/\/admin\/providers\?q=kaneshie/);
    await expect(page.getByRole('cell', { name: /Kaneshie Auto Mechanics/ })).toBeVisible();
    await expect(page.getByRole('cell', { name: /Madina Tailoring/ })).toHaveCount(0);
  });
});

test.describe('on a phone @mobile', () => {
  test('filters fold away behind a button and say how many are on', async ({ page }) => {
    await page.goto('/search?trade=welding&area=Tema');
    await expect(page.getByLabel('Trade')).toBeHidden();
    const toggle = page.getByRole('button', { name: 'Filters (2)' });
    await toggle.click();
    await expect(page.getByLabel('Trade')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Hide filters' })).toHaveAttribute('aria-expanded', 'true');
  });
});
