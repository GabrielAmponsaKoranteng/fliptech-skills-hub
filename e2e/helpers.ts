import { expect, type Page } from '@playwright/test';

const HOME = { trainee: '/app', trainer: '/trainer', admin: '/admin' } as const;
const BUTTON = { trainee: 'Trainee', trainer: 'Trainer', admin: 'Super admin' } as const;

/** Signs in with one of the demo accounts from the sign-in page and waits for its dashboard. */
export async function demoSignIn(page: Page, role: keyof typeof HOME) {
  await page.goto('/signin');
  await page.getByRole('button', { name: BUTTON[role], exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${HOME[role]}$`));
}

/** Signs out from a dashboard's sidebar. */
export async function signOut(page: Page) {
  await page.getByRole('link', { name: 'Sign out' }).click();
  await expect(page).toHaveURL('/');
}

/** The toast message area (portaled to <body>, announced politely). */
export const toast = (page: Page) => page.locator('.toast').last();
