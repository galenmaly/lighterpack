import { test, expect } from '@playwright/test';

import { testRoot } from './utils';
import { generateTestUser } from './auth-utils';

test.describe('Forgot Password Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${testRoot}forgot-password`);
    // Wait for the modal to be visible
    await expect(page.locator('#forgotPassword')).toBeVisible();
  });

  test('should display forgot password page with both forms', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Forgot Your Password?' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Forgot Your Username?' })).toBeVisible();
  });

  test('should have username input for password reset', async ({ page }) => {
    const usernameInput = page.locator('form.forgotPassword input.username');
    await expect(usernameInput).toBeVisible();
    await expect(usernameInput).toHaveAttribute('placeholder', 'Username');
  });

  test('should have email input for username recovery', async ({ page }) => {
    const emailInput = page.locator('form.forgotUsername input.email');
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute('placeholder', 'Email Address');
  });

  test('should have return to sign in link', async ({ page }) => {
    const returnLink = page.getByText('Return to sign in');
    await expect(returnLink).toBeVisible();

    await returnLink.click();
    await expect(page).toHaveURL(/\/signin/);
  });

  test('should show error when resetting password for an unknown username', async ({ page }) => {
    // Generated but never registered, so it's guaranteed not to exist
    const { username } = generateTestUser('ghost');
    await page.locator('form.forgotPassword input.username').fill(username);

    const responsePromise = page.waitForResponse(
      (response) => response.url().includes('/forgotPassword') && response.request().method() === 'POST',
    );
    await page.locator('form.forgotPassword input[type="submit"]').click();

    const response = await responsePromise;
    expect(response.status()).toBe(400);
    await expect(page.locator('form.forgotPassword'))
      .toContainText('An error occurred, please try again later.');
  });

  test('should show error when recovering username for an unknown email', async ({ page }) => {
    const { email } = generateTestUser('ghost');
    await page.locator('form.forgotUsername input.email').fill(email);

    const responsePromise = page.waitForResponse(
      (response) => response.url().includes('/forgotUsername') && response.request().method() === 'POST',
    );
    await page.locator('form.forgotUsername input[type="submit"]').click();

    const response = await responsePromise;
    expect(response.status()).toBe(400);
    await expect(page.locator('form.forgotUsername'))
      .toContainText('An error occurred, please try again later.');
  });
});
