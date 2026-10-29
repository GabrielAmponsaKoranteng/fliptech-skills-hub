import { expect, test } from '@playwright/test';
import { demoSignIn } from './helpers';

test('dialogs keep focus inside, close on Escape and hand focus back', async ({ page }) => {
  await demoSignIn(page, 'admin');
  await page.goto('/admin/users');
  const open = page.getByRole('button', { name: 'Invite admin' });
  await open.click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(':focus')).toHaveCount(1);
  // Tabbing well past the last control wraps around instead of escaping to the page behind.
  for (let i = 0; i < 15; i++) await page.keyboard.press('Tab');
  await expect(dialog.locator(':focus')).toHaveCount(1);

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(open).toBeFocused();
});

test('table rows that open details work from the keyboard', async ({ page }) => {
  await demoSignIn(page, 'admin');
  await page.goto('/admin/orders');
  const row = page.locator('tr.clickable').first();
  await row.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
});

test.describe('on a phone @mobile', () => {
  test('the dashboard menu opens, takes focus and closes on Escape', async ({ page }) => {
    await demoSignIn(page, 'trainer');
    const toggle = page.locator('[aria-controls="dash-menu"]');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    // Closed, its links are out of the tab order.
    await expect(page.locator('#dash-menu')).toBeHidden();

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#dash-menu nav a').first()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toBeFocused();
  });

  for (const path of ['/', '/search', '/marketplace', '/admin/users', '/admin/orders']) {
    test(`${path} doesn’t scroll sideways`, async ({ page }) => {
      if (path.startsWith('/admin')) await demoSignIn(page, 'admin');
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
});
