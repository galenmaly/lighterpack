import { test, expect } from '@playwright/test';

import { registerUser, loginUser, logoutUser, generateTestUser } from './auth-utils';
import { createCategory, addItem, enableSetting, disableSetting, getCategoryNames } from './test-helpers';

test.describe('Settings Persistence After Reload', () => {
  test('should persist item prices setting after reload', async ({ page }) => {
    const { username, password, email } = generateTestUser('persist-price');

    await registerUser(page, username, password, email);
    await expect(page.getByText('Welcome to LighterPack!')).toBeVisible();

    // Create item to see price field
    const category = await createCategory(page, 'Gear');
    await addItem(category, 'Test Item', { weight: '10' });

    // Enable prices and set a price value
    await enableSetting(page, 'Item prices');
    const priceInput = page.getByTestId('item-price').first();
    await expect(priceInput).toBeVisible();
    await priceInput.fill('49.99');
    await priceInput.blur();

    // Wait for auto-save
    await page.waitForResponse(
      (response) => response.url().includes('saveLibrary') && response.status() === 200,
      { timeout: 15000 },
    );

    // Reload and verify both the setting and the price value survived
    await page.reload();
    await expect(page.getByText('Add new category', { exact: true })).toBeVisible();

    await expect(page.getByTestId('item-price').first()).toBeVisible();
    await expect(page.getByTestId('item-price').first()).toHaveValue('49.99');
  });

  test('should persist list description setting after reload', async ({ page }) => {
    const { username, password, email } = generateTestUser('persist-desc');

    await registerUser(page, username, password, email);
    await expect(page.getByText('Welcome to LighterPack!')).toBeVisible();

    // Enable list descriptions
    await enableSetting(page, 'List descriptions');
    await expect(page.locator('#listDescription')).toBeVisible();

    // Add a description
    await page.locator('#listDescription').fill('My trip notes');

    // Wait for auto-save
    await page.waitForResponse(
      (response) => response.url().includes('saveLibrary') && response.status() === 200,
      { timeout: 15000 },
    );

    // Reload and verify
    await page.reload();
    await expect(page.getByText('Add new category', { exact: true })).toBeVisible();

    await expect(page.locator('#listDescription')).toBeVisible();
    await expect(page.locator('#listDescription')).toHaveValue('My trip notes');
  });

  test('should persist currency symbol after reload', async ({ page }) => {
    const { username, password, email } = generateTestUser('persist-curr');

    await registerUser(page, username, password, email);
    await expect(page.getByText('Welcome to LighterPack!')).toBeVisible();

    const category = await createCategory(page, 'Gear');
    await addItem(category, 'Test', { weight: '10' });

    // Enable prices and change currency
    await enableSetting(page, 'Item prices');
    const currencyInput = page.locator('#currencySymbol');
    await currencyInput.fill('€');
    await currencyInput.blur();

    // Wait for auto-save
    await page.waitForResponse(
      (response) => response.url().includes('saveLibrary') && response.status() === 200,
      { timeout: 15000 },
    );

    // Reload and verify
    await page.reload();
    await expect(page.getByText('Add new category', { exact: true })).toBeVisible();

    await expect(page.locator('#currencySymbol')).toHaveValue('€');
  });

  test('should persist worn items toggle after reload', async ({ page }) => {
    const { username, password, email } = generateTestUser('persist-worn');

    await registerUser(page, username, password, email);
    await expect(page.getByText('Welcome to LighterPack!')).toBeVisible();

    const category = await createCategory(page, 'Clothing');
    await addItem(category, 'Boots', { weight: '20' });

    // Disable worn items
    await disableSetting(page, 'Worn items');

    // Verify worn icon is hidden
    const itemRow = page.getByTestId('item-row').first();
    await itemRow.hover();
    await expect(itemRow.getByTitle('Mark this item as worn')).toHaveCount(0);

    // Wait for auto-save
    await page.waitForResponse(
      (response) => response.url().includes('saveLibrary') && response.status() === 200,
      { timeout: 15000 },
    );

    // Reload and verify worn is still disabled
    await page.reload();
    await expect(page.getByText('Add new category', { exact: true })).toBeVisible();

    const itemRowAfter = page.getByTestId('item-row').first();
    await itemRowAfter.hover();
    await expect(itemRowAfter.getByTitle('Mark this item as worn')).toHaveCount(0);
  });

  test('should persist consumable items toggle after reload', async ({ page }) => {
    const { username, password, email } = generateTestUser('persist-cons');

    await registerUser(page, username, password, email);
    await expect(page.getByText('Welcome to LighterPack!')).toBeVisible();

    const category = await createCategory(page, 'Food');
    await addItem(category, 'Snacks', { weight: '8' });

    // Disable consumable items
    await disableSetting(page, 'Consumable items');

    // Verify consumable icon is hidden
    const itemRow = page.getByTestId('item-row').first();
    await itemRow.hover();
    await expect(itemRow.getByTitle('Mark this item as a consumable')).toHaveCount(0);

    // Wait for auto-save
    await page.waitForResponse(
      (response) => response.url().includes('saveLibrary') && response.status() === 200,
      { timeout: 15000 },
    );

    // Reload and verify
    await page.reload();
    await expect(page.getByText('Add new category', { exact: true })).toBeVisible();

    const itemRowAfter = page.getByTestId('item-row').first();
    await itemRowAfter.hover();
    await expect(itemRowAfter.getByTitle('Mark this item as a consumable')).toHaveCount(0);
  });
});

test.describe('Settings Toggle Interactions', () => {
  test.beforeEach(async ({ page }) => {
    const { username, password, email } = generateTestUser('toggle');
    await registerUser(page, username, password, email);
    await expect(page.getByText('Welcome to LighterPack!')).toBeVisible();
  });

  test('should toggle item images setting', async ({ page }) => {
    const category = await createCategory(page, 'Photo Gear');
    await addItem(category, 'Camera', { weight: '16' });

    // Initially images may be disabled - enable them
    await enableSetting(page, 'Item images');

    // When images are enabled, the image cell should exist in the DOM
    const itemRow = page.getByTestId('item-row').first();
    await expect(itemRow.locator('.lpImageCell')).toHaveCount(1);

    // Disable images
    await disableSetting(page, 'Item images');

    // When images are disabled, the image cell should be removed from DOM (v-if)
    await expect(itemRow.locator('.lpImageCell')).toHaveCount(0);
  });

  test('should show/hide price column when toggled', async ({ page }) => {
    const category = await createCategory(page, 'Priced Gear');
    await addItem(category, 'Expensive Item', { weight: '5' });

    // Enable prices
    await enableSetting(page, 'Item prices');
    await expect(page.getByTestId('item-price').first()).toBeVisible();
    await expect(page.locator('#currencySymbol')).toBeVisible();

    // Disable prices
    await disableSetting(page, 'Item prices');
    await expect(page.getByTestId('item-price')).toHaveCount(0);
    await expect(page.locator('#currencySymbol')).toHaveCount(0);
  });

  test('should show/hide list description when toggled', async ({ page }) => {
    // Enable descriptions
    await enableSetting(page, 'List descriptions');
    await expect(page.locator('#listDescription')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'List Description' })).toBeVisible();

    // Disable descriptions
    await disableSetting(page, 'List descriptions');
    await expect(page.locator('#listDescription')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'List Description' })).toHaveCount(0);
  });
});

test.describe('List Name Persistence', () => {
  test('should persist list name after reload', async ({ page }) => {
    const { username, password, email } = generateTestUser('listname');

    await registerUser(page, username, password, email);
    await expect(page.getByText('Welcome to LighterPack!')).toBeVisible();

    const listNameInput = page.getByPlaceholder('List Name', { exact: true });
    await listNameInput.fill('My Backpacking Trip');
    await listNameInput.blur();

    // Wait for auto-save
    await page.waitForResponse(
      (response) => response.url().includes('saveLibrary') && response.status() === 200,
      { timeout: 15000 },
    );

    // Reload and verify
    await page.reload();
    await expect(page.getByText('Add new category', { exact: true })).toBeVisible();

    await expect(listNameInput).toHaveValue('My Backpacking Trip');
  });

  // Note: Category and item persistence is implicitly tested by the Settings Persistence tests
  // which create categories/items and verify they exist after reload (e.g., item prices test
  // checks for item-price input which requires the item to have persisted)
});

test.describe('Data Persistence Across Sessions', () => {
  test('should persist list data after logout and login', async ({ page }) => {
    const { username, password, email } = generateTestUser('persist-session');

    await registerUser(page, username, password, email);
    await expect(page.getByText('Welcome to LighterPack!')).toBeVisible();

    const listNameInput = page.getByPlaceholder('List Name', { exact: true });
    await listNameInput.fill('Session Persist List');
    await listNameInput.blur();

    const category = await createCategory(page, 'Shelter');
    await addItem(category, 'Tent', { weight: '32' });

    // Wait for auto-save to flush to the server
    await page.waitForResponse(
      (response) => response.url().includes('saveLibrary') && response.status() === 200,
      { timeout: 15000 },
    );

    await logoutUser(page);
    await expect(page.getByRole('heading').filter({ hasText: 'Sign in' })).toBeVisible();

    await loginUser(page, username, password);
    await expect(page.getByTestId('account-menu')).toContainText(username);

    await expect(listNameInput).toHaveValue('Session Persist List');

    const categoryNames = await getCategoryNames(page);
    expect(categoryNames).toContain('Shelter');

    const itemNames = await page.getByTestId('item-row').evaluateAll((nodes) =>
      nodes.map((node) => {
        const input = node.querySelector('input.lpName') as HTMLInputElement | null;
        return input ? input.value : '';
      }),
    );
    expect(itemNames).toContain('Tent');
  });
});
