import { test, expect } from '@playwright/test';

import { registerUser, generateTestUser, loginUser, logoutUser } from './auth-utils';
import { openSidebar, createCategoryWithItem } from './test-helpers';

test.describe('Account Settings', () => {
  test.beforeEach(async ({ page }) => {
    const { username, password, email } = generateTestUser('acct');
    await registerUser(page, username, password, email);
    await expect(page.getByText('Welcome to LighterPack!')).toBeVisible();
  });

  test('should open account settings modal from dropdown', async ({ page }) => {
    await page.getByTestId('account-menu').hover();
    await page.getByText('Account Settings').click();

    const modal = page.locator('#accountSettings');
    await expect(modal).toBeVisible();
    await expect(modal.getByRole('heading', { name: 'Account Settings' })).toBeVisible();
  });

  test('should display username as disabled in settings', async ({ page }) => {
    await page.getByTestId('account-menu').hover();
    await page.getByText('Account Settings').click();

    const usernameInput = page.locator('#accountSettings input.username');
    await expect(usernameInput).toBeVisible();
    await expect(usernameInput).toBeDisabled();
  });

  test('should require current password for changes', async ({ page }) => {
    await page.getByTestId('account-menu').hover();
    await page.getByText('Account Settings').click();

    const modal = page.locator('#accountSettings');
    await modal.getByPlaceholder('New Email').fill('newemail@example.com');
    await modal.getByRole('button', { name: 'Submit' }).click();

    await expect(page.getByText('Please enter your current password.')).toBeVisible();
  });

  test('should validate password match', async ({ page }) => {
    await page.getByTestId('account-menu').hover();
    await page.getByText('Account Settings').click();

    const modal = page.locator('#accountSettings');
    await modal.getByPlaceholder('Current Password').fill('testtest');
    await modal.getByPlaceholder('New Password', { exact: true }).fill('newpassword123');
    await modal.getByPlaceholder('Confirm New Password').fill('differentpassword');
    await modal.getByRole('button', { name: 'Submit' }).click();

    await expect(page.getByText("Your passwords don't match.")).toBeVisible();
  });

  test('should validate password length', async ({ page }) => {
    await page.getByTestId('account-menu').hover();
    await page.getByText('Account Settings').click();

    const modal = page.locator('#accountSettings');
    await modal.getByPlaceholder('Current Password').fill('testtest');
    await modal.getByPlaceholder('New Password', { exact: true }).fill('abc');
    await modal.getByPlaceholder('Confirm New Password').fill('abc');
    await modal.getByRole('button', { name: 'Submit' }).click();

    await expect(page.getByText('Please enter a password between 5 and 60 characters.')).toBeVisible();
  });

  test('should close modal on cancel', async ({ page }) => {
    await page.getByTestId('account-menu').hover();
    await page.getByText('Account Settings').click();

    const modal = page.locator('#accountSettings');
    await expect(modal).toBeVisible();

    await modal.getByText('Cancel').click();
    await expect(modal).not.toBeVisible();
  });

  test('should change password successfully', async ({ page }) => {
    const { username } = generateTestUser('pwchange');
    const originalPassword = 'testtest';
    const newPassword = 'newpassword123';

    // Register a fresh user for this test
    await logoutUser(page);
    await registerUser(page, username, originalPassword, `${username}@test.com`);
    await expect(page.getByText('Welcome to LighterPack!')).toBeVisible();

    // Change password
    await page.getByTestId('account-menu').hover();
    await page.getByText('Account Settings').click();

    const modal = page.locator('#accountSettings');
    await modal.getByPlaceholder('Current Password').fill(originalPassword);
    await modal.getByPlaceholder('New Password', { exact: true }).fill(newPassword);
    await modal.getByPlaceholder('Confirm New Password').fill(newPassword);
    await modal.getByRole('button', { name: 'Submit' }).click();

    // Wait for modal to close (indicates success)
    await expect(modal).not.toBeVisible({ timeout: 10000 });

    // Logout and login with new password
    await logoutUser(page);
    await loginUser(page, username, newPassword);
    await expect(page.getByText('Welcome to LighterPack!')).toBeVisible();
  });

  test('should reject incorrect current password', async ({ page }) => {
    await page.getByTestId('account-menu').hover();
    await page.getByText('Account Settings').click();

    const modal = page.locator('#accountSettings');
    await modal.getByPlaceholder('Current Password').fill('wrongpassword');
    await modal.getByPlaceholder('New Password', { exact: true }).fill('newpassword123');
    await modal.getByPlaceholder('Confirm New Password').fill('newpassword123');

    const responsePromise = page.waitForResponse(
      (response) => response.url().includes('/account') && response.request().method() === 'POST',
    );
    await modal.getByRole('button', { name: 'Submit' }).click();

    const response = await responsePromise;
    expect(response.status()).toBe(400);

    await expect(modal.getByText('Your current password is incorrect.')).toBeVisible();
    await expect(modal).toBeVisible();
  });
});

test.describe('Account Dropdown', () => {
  test.beforeEach(async ({ page }) => {
    const { username, password, email } = generateTestUser('dropdown');
    await registerUser(page, username, password, email);
    await expect(page.getByText('Welcome to LighterPack!')).toBeVisible();
  });

  test('should display username in dropdown', async ({ page }) => {
    const usernameSpan = page.getByTestId('account-menu').locator('.username');
    await expect(usernameSpan).toBeVisible();
    const username = await usernameSpan.textContent();
    expect(username).toMatch(/^dropdown/);
  });

  test('should show dropdown menu on hover', async ({ page }) => {
    await page.getByTestId('account-menu').hover();

    await expect(page.getByText('Account Settings')).toBeVisible();
    await expect(page.getByText('Help')).toBeVisible();
    await expect(page.getByText('Sign Out')).toBeVisible();
  });

  test('should sign out from dropdown', async ({ page }) => {
    await page.getByTestId('account-menu').hover();
    await page.getByText('Sign Out').click();

    // Should redirect to sign in page
    await expect(page).toHaveURL(/\/signin/);
  });
});

test.describe('Shared item bubble preference', () => {
  test('unchecking the preference suppresses the bubble and persists', async ({ page }) => {
    const { username, password, email } = generateTestUser('acct-nag');
    await registerUser(page, username, password, email);
    await expect(page.getByText('Welcome to LighterPack!')).toBeVisible();

    await openSidebar(page);
    const listNameInput = page.getByPlaceholder('Name your list', { exact: true });
    await listNameInput.fill('Original List');
    await listNameInput.blur();
    await createCategoryWithItem(page, 'Shelter', 'Shared Tent');

    // Copying the list shares the item, which makes the bubble appear.
    await page.getByTestId('new-list').hover();
    await page.getByText('Copy a list', { exact: true }).click();
    const listToCopy = page.locator('#listToCopy');
    await expect(listToCopy).toBeVisible();
    await listToCopy.selectOption({ label: 'Original List' });
    await page.locator('#copyConfirm').click();
    await expect(listNameInput).toHaveValue('Copy of Original List');

    const itemRow = page.getByTestId('category').last().getByTestId('item-row').nth(1);
    await itemRow.getByPlaceholder('Name', { exact: true }).click();
    await expect(page.getByTestId('shared-item-bubble')).toBeVisible();

    // Turn the warning off in account settings.
    await page.getByTestId('account-menu').hover();
    await page.getByText('Account Settings').click();
    const checkbox = page.getByTestId('shared-item-bubble-toggle');
    await expect(checkbox).toBeChecked();
    await checkbox.uncheck();
    await page.locator('#accountSettings').getByText('Cancel').click();

    await itemRow.getByPlaceholder('Name', { exact: true }).click();
    await expect(page.getByTestId('shared-item-bubble')).toHaveCount(0);

    // The preference survives a reload.
    await page.waitForResponse(
      (response) => response.url().includes('saveLibrary') && response.status() === 200,
      { timeout: 15000 },
    );
    await page.reload();
    const rowAfter = page.getByTestId('category').last().getByTestId('item-row').nth(1);
    await rowAfter.getByPlaceholder('Name', { exact: true }).click();
    await expect(page.getByTestId('shared-item-bubble')).toHaveCount(0);
  });
});
