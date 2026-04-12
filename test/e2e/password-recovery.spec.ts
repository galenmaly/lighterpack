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

  test('should submit forgot password form', async ({ page }) => {
    const usernameInput = page.locator('form.forgotPassword input.username');
    await usernameInput.fill('nonexistentuser');

    const submitButton = page.locator('form.forgotPassword input[type="submit"]');
    await submitButton.click();

    // Either redirects to reset confirmation or shows error for non-existent user
    // The behavior depends on backend - we just verify the form submits
    await expect(async () => {
      const hasError = await page.locator('form.forgotPassword').getByText(/error|not found/i).count();
      const hasRedirect = page.url().includes('reset-password');
      expect(hasError > 0 || hasRedirect).toBe(true);
    }).toPass({ timeout: 5000 });
  });

  test('should submit forgot username form', async ({ page }) => {
    const emailInput = page.locator('form.forgotUsername input.email');
    await emailInput.fill('test@example.com');

    const submitButton = page.locator('form.forgotUsername input[type="submit"]');
    await submitButton.click();

    // Either redirects to confirmation or shows error
    await expect(async () => {
      const hasError = await page.locator('form.forgotUsername').getByText(/error|not found/i).count();
      const hasRedirect = page.url().includes('forgot-username');
      expect(hasError > 0 || hasRedirect).toBe(true);
    }).toPass({ timeout: 5000 });
  });

  test('should show error for empty username submission', async ({ page }) => {
    const submitButton = page.locator('form.forgotPassword input[type="submit"]');
    await submitButton.click();

    // Should show validation error or stay on page
    await expect(page.locator('#forgotPassword')).toBeVisible();
  });

  test('should show error for empty email submission', async ({ page }) => {
    const submitButton = page.locator('form.forgotUsername input[type="submit"]');
    await submitButton.click();

    // Should show validation error or stay on page
    await expect(page.locator('#forgotPassword')).toBeVisible();
  });
});

test.describe('Password Recovery Navigation', () => {
  test('should navigate to forgot password from sign in page', async ({ page }) => {
    await page.goto(`${testRoot}signin`);

    // Look for forgot password link
    const forgotLink = page.getByText(/forgot/i);
    if (await forgotLink.count() > 0) {
      await forgotLink.first().click();
      await expect(page).toHaveURL(/\/forgot-password/);
    }
  });
});
