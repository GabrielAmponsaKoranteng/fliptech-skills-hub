import { expect, test } from '@playwright/test';

test('a visitor finds a centre and sends an enquiry without an account', async ({ page }) => {
  await page.goto('/search');
  await page.getByPlaceholder('Search skills or providers…').fill('welding');
  await page.getByPlaceholder('Search skills or providers…').press('Enter');
  await page.getByRole('link', { name: /Accra Central Welding Works/ }).first().click();

  await expect(page.getByRole('heading', { level: 1, name: 'Accra Central Welding Works' })).toBeVisible();
  await page.getByRole('link', { name: 'Enquire now' }).click();

  await expect(page.getByRole('heading', { name: 'Enquire about this training' })).toBeVisible();
  // The phone number is required and checked before anything is sent.
  await page.getByRole('button', { name: 'Send enquiry' }).click();
  await expect(page.getByLabel('Your phone number')).toHaveAttribute('aria-invalid', 'true');

  await page.getByLabel('Your phone number').fill('024 555 1234');
  await page.getByLabel('Your name').fill('Abena Test');
  await page.getByLabel('Your message').fill('Is the weekend class open?');
  await page.getByRole('button', { name: 'Send enquiry' }).click();
  await expect(page.getByRole('heading', { name: 'Enquiry sent!' })).toBeVisible();
});

test('unknown pages show a friendly not-found page', async ({ page }) => {
  await page.goto('/no-such-page');
  await expect(page.getByRole('heading', { name: 'We couldn’t find that page' })).toBeVisible();
  await page.getByRole('link', { name: 'Go home' }).click();
  await expect(page).toHaveURL('/');
});

test('the skip link moves keyboard focus to the main content', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('main#main')).toBeVisible();
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await expect(skip).toBeFocused();
  await skip.press('Enter');
  await expect(page.locator('main#main')).toBeFocused();
});
