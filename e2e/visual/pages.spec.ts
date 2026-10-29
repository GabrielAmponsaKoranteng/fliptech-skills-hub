// Visual regression: screenshots of key pages compared with approved baselines.
//   npm run visual          compare
//   npm run visual:update   accept the current look as the new baseline (review the images first)
// Runs at a laptop size and a phone size. Baselines live in e2e/visual/__screenshots__/<os>/.
import { expect, test, type Page } from '@playwright/test';
import { demoSignIn } from '../helpers';
import { settled, stabilise } from './stable';

test.beforeEach(async ({ page }) => { await stabilise(page); });

async function shot(page: Page, name: string, fullPage = true) {
  await settled(page);
  await expect(page).toHaveScreenshot(`${name}.png`, { fullPage });
}

test.describe('public pages @visual', () => {
  const pages: [name: string, path: string][] = [
    ['home', '/'],
    ['search', '/search'],
    ['search-no-results', '/search?q=weldng&area=Kasoa'],
    ['provider', '/providers/accra-central-welding'],
    ['marketplace', '/marketplace'],
    ['courses', '/courses'],
    ['product', '/marketplace/m9'],
    ['course', '/courses/c3'],
    ['cart-empty', '/cart'],
    ['sign-in', '/signin'],
    ['register', '/signup'],
    ['not-found', '/no-such-page'],
  ];
  for (const [name, path] of pages) {
    test(name, async ({ page }) => {
      await page.goto(path);
      await shot(page, name);
    });
  }

  test('cart with items', async ({ page }) => {
    await page.goto('/marketplace/m9');
    await page.getByRole('button', { name: 'Add to cart' }).click();
    await page.goto('/cart');
    await shot(page, 'cart-items');
  });
});

test.describe('dashboards @visual', () => {
  const pages: [role: 'trainee' | 'trainer' | 'admin', name: string, path: string][] = [
    ['trainee', 'trainee-dashboard', '/app'],
    ['trainee', 'trainee-orders', '/app/orders'],
    ['trainer', 'trainer-overview', '/trainer'],
    ['trainer', 'trainer-enquiries', '/trainer/enquiries'],
    ['trainer', 'trainer-listings', '/trainer/listings'],
    ['admin', 'admin-overview', '/admin'],
    ['admin', 'admin-verification', '/admin/verification'],
    ['admin', 'admin-orders', '/admin/orders'],
  ];
  for (const [role, name, path] of pages) {
    test(name, async ({ page }) => {
      await demoSignIn(page, role);
      if (path !== new URL(page.url()).pathname) await page.goto(path);
      // Dashboards have a fixed sidebar and scroll inside; the visible screen is what matters.
      await shot(page, name, false);
    });
  }

  test('admin invite dialog', async ({ page }) => {
    await demoSignIn(page, 'admin');
    await page.goto('/admin/users');
    await page.getByRole('button', { name: 'Invite admin' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await shot(page, 'admin-invite-dialog', false);
  });
});
