import { expect, test } from '@playwright/test';
import { signOut } from './helpers';

test('a new trainee registers, signs out and signs back in', async ({ page }) => {
  await page.goto('/signup');
  await page.getByRole('button', { name: /Continue as trainee/ }).click();
  await page.getByLabel('Full name').fill('Yaa Test');
  await page.getByLabel('Phone number').fill('024 777 8899');
  await page.getByLabel('Password').fill('correct-horse');
  await page.getByRole('checkbox', { name: /I agree/ }).check();
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole('heading', { level: 1, name: /Welcome, Yaa/ })).toBeVisible();

  await signOut(page);
  await page.goto('/signin');
  await page.getByLabel('Phone number or email').fill('024 777 8899');
  // The mock doesn't store passwords yet (see docs/API.md), so this checks the flow, not the password.
  await page.getByLabel('Password', { exact: true }).fill('correct-horse');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
});

test('a forgotten password can be reset with the link, once', async ({ page }) => {
  await page.goto('/signin');
  await page.getByRole('link', { name: 'Forgot password?' }).click();
  await page.getByLabel('Phone number or email').fill('kwame@example.com');
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByRole('heading', { name: 'Check your messages' })).toBeVisible();

  // Nothing is really sent in the demo, so the page shows the link that would have been.
  await page.getByRole('link', { name: 'Open the reset link' }).click();
  const link = page.url();
  await page.getByLabel('New password', { exact: true }).fill('new-secret-1');
  await page.getByLabel('Confirm new password').fill('new-secret-1');
  await page.getByRole('button', { name: 'Save new password' }).click();
  await expect(page.getByRole('heading', { name: 'Password updated' })).toBeVisible();

  await page.getByRole('link', { name: 'Sign in' }).last().click();
  await page.getByLabel('Phone number or email').fill('kwame@example.com');
  await page.getByLabel('Password', { exact: true }).fill('new-secret-1');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);

  // The same link can't be used twice.
  await signOut(page);
  await page.goto(link);
  await page.getByLabel('New password', { exact: true }).fill('another-pass');
  await page.getByLabel('Confirm new password').fill('another-pass');
  await page.getByRole('button', { name: 'Save new password' }).click();
  await expect(page.getByRole('heading', { name: 'This link doesn’t work' })).toBeVisible();
});

test('dashboards send signed-out visitors to sign in', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/signin/);
});
