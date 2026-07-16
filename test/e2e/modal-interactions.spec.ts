import { test, expect } from '@playwright/test';

import { registerUser, generateTestUser } from './auth-utils';
import { createCategory } from './test-helpers';

test.describe('Modal Escape Key Behavior', () => {
  test.beforeEach(async ({ page }) => {
    const { username, password, email } = generateTestUser('modal');
    await registerUser(page, username, password, email);
    await expect(page.getByText('Welcome to LighterPack!')).toBeVisible();
  });

  test('should close account settings modal with escape key', async ({ page }) => {
    await page.getByTestId('account-menu').hover();
    await page.getByText('Account Settings').click();

    const modal = page.locator('#accountSettings');
    await expect(modal).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
  });

});

test.describe('Modal Backdrop Click Behavior', () => {
  test.beforeEach(async ({ page }) => {
    const { username, password, email } = generateTestUser('backdrop');
    await registerUser(page, username, password, email);
    await expect(page.getByText('Welcome to LighterPack!')).toBeVisible();
  });

  test('should close account settings modal on backdrop click', async ({ page }) => {
    await page.getByTestId('account-menu').hover();
    await page.getByText('Account Settings').click();

    const modal = page.locator('#accountSettings');
    await expect(modal).toBeVisible();

    // Click on the overlay at a corner position (outside the modal content)
    await page.locator('.lpModalOverlay').click({ position: { x: 10, y: 10 } });
    await expect(modal).not.toBeVisible();
  });

  test('should not close modal when clicking inside modal content', async ({ page }) => {
    await page.getByTestId('account-menu').hover();
    await page.getByText('Account Settings').click();

    const modal = page.locator('#accountSettings');
    await expect(modal).toBeVisible();

    // Click inside the modal
    await modal.getByRole('heading', { name: 'Account Settings' }).click();
    await expect(modal).toBeVisible();
  });
});

test.describe('Confirmation Dialog (Speedbump)', () => {
  test.beforeEach(async ({ page }) => {
    const { username, password, email } = generateTestUser('confirm');
    await registerUser(page, username, password, email);
    await expect(page.getByText('Welcome to LighterPack!')).toBeVisible();
  });

  test('should show confirmation dialog when deleting category', async ({ page }) => {
    const category = await createCategory(page, 'Delete Test');

    await category.locator('.lpItemsHeader').hover();
    await category.getByTitle('Remove this category').click();

    // Confirmation dialog should appear
    await expect(page.getByRole('button', { name: 'Yes' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'No' })).toBeVisible();
  });

  test('should cancel deletion when clicking No', async ({ page }) => {
    const category = await createCategory(page, 'Cancel Delete');

    const initialCount = await page.getByTestId('category').count();

    await category.locator('.lpItemsHeader').hover();
    await category.getByTitle('Remove this category').click();

    await page.getByRole('button', { name: 'No' }).click();

    // Category should still exist
    await expect(page.getByTestId('category')).toHaveCount(initialCount);
  });

  test('should proceed with deletion when clicking Yes', async ({ page }) => {
    const category = await createCategory(page, 'Confirm Delete');

    const initialCount = await page.getByTestId('category').count();

    await category.locator('.lpItemsHeader').hover();
    await category.getByTitle('Remove this category').click();

    await page.getByRole('button', { name: 'Yes' }).click();

    // Category should be deleted
    await expect(page.getByTestId('category')).toHaveCount(initialCount - 1);
  });
});

test.describe('Keyboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    const { username, password, email } = generateTestUser('keyboard');
    await registerUser(page, username, password, email);
    await expect(page.getByText('Welcome to LighterPack!')).toBeVisible();
  });

  test('should navigate between item fields with Tab', async ({ page }) => {
    const category = await createCategory(page, 'Tab Test');
    await category.getByText('Add new item', { exact: true }).click();

    const itemRow = category.getByTestId('item-row').last();
    const nameInput = itemRow.getByPlaceholder('Name', { exact: true });

    await nameInput.focus();
    await nameInput.fill('Tab Item');

    // Tab to next field (description)
    await page.keyboard.press('Tab');

    const descInput = itemRow.getByPlaceholder('Description', { exact: true });
    await expect(descInput).toBeFocused();
  });
});
