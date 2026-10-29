import { expect, test } from '@playwright/test';
import { demoSignIn, toast } from './helpers';

test('a centre replies to a guest enquiry and its dashboard counts it', async ({ page }) => {
  await page.goto('/providers/accra-central-welding/enquire');
  await page.getByLabel('Your phone number').fill('024 555 9876');
  await page.getByLabel('Your name').fill('Kojo Playwright');
  await page.getByRole('button', { name: 'Send enquiry' }).click();
  await expect(page.getByRole('heading', { name: 'Enquiry sent!' })).toBeVisible();

  await demoSignIn(page, 'trainer');
  const enquiries = page.locator('.stat').filter({ has: page.getByText('Enquiries (30 days)', { exact: true }) }).locator('.stat-val');
  await expect(enquiries).not.toHaveText('—');
  const before = Number((await enquiries.textContent())!.replace(/,/g, ''));

  await page.getByRole('link', { name: /Kojo Playwright/ }).first().click();
  await expect(page).toHaveURL(/\/trainer\/enquiries$/);
  await page.locator('.inbox-item', { hasText: 'Kojo Playwright' }).click();
  await page.getByRole('textbox').last().fill('Yes, the weekend class is open. Come on Saturday.');
  await page.getByRole('button', { name: /Send/ }).last().click();
  await expect(toast(page)).toContainText('Reply sent to Kojo Playwright by SMS');
  await expect(page.locator('.inbox-item', { hasText: 'Kojo Playwright' })).toContainText('Replied');

  await page.getByRole('link', { name: 'Overview' }).click();
  await expect(enquiries).toHaveText(String(before));
});

test('an admin approves an application and the centre goes live in search', async ({ page }) => {
  await page.goto('/search?q=Kpone');
  await expect(page.getByRole('link', { name: /Kpone Steel Fabrication Hub/ })).toHaveCount(0);

  await demoSignIn(page, 'admin');
  await page.goto('/admin/verification');
  const row = page.locator('.card, li, tr', { hasText: 'Kpone Steel Fabrication Hub' }).filter({ has: page.getByRole('button', { name: 'Approve' }) }).last();
  await row.getByRole('button', { name: 'Approve' }).click();
  await expect(toast(page)).toContainText('Kpone Steel Fabrication Hub approved and published');

  await page.goto('/search?q=Kpone');
  await expect(page.getByRole('link', { name: /Kpone Steel Fabrication Hub/ }).first()).toBeVisible();
});

test('a support admin only sees the parts of the dashboard for their role', async ({ page }) => {
  // Efua Sarpong is a seeded admin with support access: users, enquiries and orders only.
  await page.goto('/signin');
  await page.getByLabel('Phone number or email').fill('efua@fliptech.com');
  await page.getByLabel('Password', { exact: true }).fill('any-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);

  await expect(page.getByRole('link', { name: /^Orders/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Verification queue' })).toHaveCount(0);
  await page.goto('/admin/verification');
  await expect(page.getByText('This isn’t part of your role')).toBeVisible();
});
