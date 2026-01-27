import { test, expect } from '@playwright/test';

import { testRoot } from './utils';

import { registerUser, loginUser, logoutUser } from './auth-utils';

test('has title', async ({ page }) => {
  await page.goto(testRoot);

  await expect(page).toHaveTitle(/LighterPack/);
});

test.describe('User Authentication Tests', () => {
  test('should successfully register a new user', async ({ page }) => {
    await page.goto(testRoot);

    const now = Date.now();
    const username = `test${now}`;
    const email = `test+${now}@lighterpack.com`;
    const password = 'testtest';

    await registerUser(page, username, password, email);
    await expect(page.getByText(`Signed in as ${username}`)).toBeVisible();
    await expect(page.getByText('Welcome to LighterPack!')).toBeVisible();
  });

  test('should successfully log in an existing user', async ({ page }) => {
    await page.goto(testRoot);

    // Register a new user first, then log out and log back in
    const now = Date.now();
    const username = `login${now}`;
    const email = `login+${now}@lighterpack.com`;
    const password = 'testtest';

    await registerUser(page, username, password, email);
    await logoutUser(page);

    await loginUser(page, username, password);
    await expect(page.getByText(`Signed in as ${username}`)).toBeVisible();
    await expect(page.getByText('Welcome to LighterPack!')).toBeVisible();
  });

  test('should successfully log out', async ({ page }) => {
    await page.goto(testRoot);

    // Register a new user first
    const now = Date.now();
    const username = `logout${now}`;
    const email = `logout+${now}@lighterpack.com`;
    const password = 'testtest';

    await registerUser(page, username, password, email);
    await logoutUser(page);
    await expect(page.getByRole('heading').filter({hasText: 'Sign in'})).toBeVisible();
  });

  test('should successfully change password', async ({ page }) => {
    await page.goto(testRoot);

    const now = Date.now();
    const username = `pw${now}`;
    const email = `pw+${now}@lighterpack.com`;
    const password = 'testtest';
    const newPassword = 'testtest2';

    await registerUser(page, username, password, email);
    await page.getByText('Signed in as').hover();
    await page.getByText('Account Settings').click();

    await page.getByPlaceholder('New Password', { exact: true }).fill(newPassword);
    await page.getByPlaceholder('Confirm New Password').fill(newPassword);

    await page.getByText('Submit').click();

    await expect(page.getByText('Please enter your current password.')).toBeVisible();

    // Use the password input in the account settings modal
    await page.locator('.lpModal').getByPlaceholder('Current password').fill(password);

    await page.getByText('Submit').click();
    await expect(page.getByRole('heading').filter({hasText: 'Account Settings'})).toBeHidden();

    await logoutUser(page);

    await expect(page.getByText('Welcome to LighterPack!')).toBeHidden();

    await loginUser(page, username, newPassword);

    await expect(page.getByText('Welcome to LighterPack!')).toBeVisible();
  });

  test('should successfully delete a user', async ({ page }) => {
    await page.goto(testRoot);

    const now = Date.now();
    const username = `del${now}`;
    const email = `del+${now}@lighterpack.com`;
    const password = 'testtest';

    await registerUser(page, username, password, email);
    await page.getByText('Signed in as').hover();
    await page.getByText('Account Settings').click();
    await page.getByText('Delete Account').click();
    await page.getByText('Permanently delete account').click();

    await expect(page.getByText('Please enter your current password.')).toBeVisible();
    await expect(page.getByText('Please enter the confirmation text.')).toBeVisible();

    // Use more specific selector for the delete modal password field
    const deleteModal = page.locator('.lpModal').filter({ hasText: 'delete my account' });
    await deleteModal.getByPlaceholder('Current password').fill(password);
    await deleteModal.getByPlaceholder('Confirmation text').fill('delete my account');

    await page.getByText('Permanently delete account').click();
    await expect(page.getByRole('heading').filter({hasText: 'Sign in'})).toBeVisible();
  });
});
