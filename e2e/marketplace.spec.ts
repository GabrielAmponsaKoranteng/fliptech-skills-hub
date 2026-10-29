import { expect, test } from '@playwright/test';
import { demoSignIn, signOut } from './helpers';

test('a trainee buys a product, and the seller sees the order', async ({ page }) => {
  await demoSignIn(page, 'trainee');
  await page.goto('/marketplace');
  await page.getByRole('link', { name: /Metal Fabrication Starter Toolkit/ }).first().click();
  await page.getByRole('button', { name: 'Add to cart' }).click();

  await page.goto('/cart');
  await expect(page.getByRole('heading', { level: 1, name: 'Your cart' })).toBeVisible();
  await page.getByRole('link', { name: 'Checkout' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Checkout' })).toBeVisible();
  // Contact details come from the signed-in account; delivery needs an area and address.
  await expect(page.getByLabel('Full name')).toHaveValue('Kwame Mensah');
  await page.getByLabel('Area').selectOption({ index: 1 });
  await page.getByLabel('Street, house no. or landmark').fill('House 12, Main Street');
  await page.getByRole('radio', { name: /Pay on delivery/ }).check();
  await page.getByRole('button', { name: 'Place order' }).click();

  await expect(page.getByRole('heading', { name: 'Order placed!' })).toBeVisible();
  const orderId = (await page.getByText(/FSH-[A-Z0-9]{6}/).first().textContent())!.match(/FSH-[A-Z0-9]{6}/)![0];

  await page.goto('/app/orders');
  await expect(page.getByText(orderId).first()).toBeVisible();

  await signOut(page);
  await demoSignIn(page, 'trainer');
  await page.goto('/trainer/orders');
  await expect(page.getByText(orderId).first()).toBeVisible();
});

test('an empty cart says so and links back to shopping', async ({ page }) => {
  await page.goto('/cart');
  await expect(page.getByRole('heading', { level: 1, name: /cart/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /marketplace|browse|shop/i }).first()).toBeVisible();
});
