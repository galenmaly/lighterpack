import { test, expect } from '@playwright/test';

import { registerUser, generateTestUser } from './auth-utils';
import { openSidebar, createCategory, addItem } from './test-helpers';

test.describe('Library Search', () => {
  test('should filter library items by search text', async ({ page }) => {
    const { username, password, email } = generateTestUser('libsearch');

    await registerUser(page, username, password, email);

    const category = await createCategory(page, 'Search Gear');
    await addItem(category, 'Solar Charger Z1', { description: 'USB panel' });
    await addItem(category, 'Titanium Spork Q9', { description: 'Ultralight spork' });

    await openSidebar(page);

    const searchInput = page.locator('#librarySearch');
    await searchInput.fill('Spork Q9');

    await expect(page.locator('#library').getByText('Titanium Spork Q9', { exact: true })).toBeVisible();
    await expect(page.locator('#library').getByText('Solar Charger Z1', { exact: true })).toHaveCount(0);
  });

  test('should search case-insensitively', async ({ page }) => {
    const { username, password, email } = generateTestUser('libcase');

    await registerUser(page, username, password, email);

    const category = await createCategory(page, 'Case Test');
    await addItem(category, 'UPPERCASE Item', { description: 'Testing case' });
    await addItem(category, 'lowercase item', { description: 'Testing case' });

    await openSidebar(page);

    const searchInput = page.locator('#librarySearch');

    // Search with lowercase for uppercase item
    await searchInput.fill('uppercase');
    await expect(page.locator('#library').getByText('UPPERCASE Item', { exact: true })).toBeVisible();

    // Search with uppercase for lowercase item
    await searchInput.clear();
    await searchInput.fill('LOWERCASE');
    await expect(page.locator('#library').getByText('lowercase item', { exact: true })).toBeVisible();
  });

  test('should search by partial match', async ({ page }) => {
    const { username, password, email } = generateTestUser('libpartial');

    await registerUser(page, username, password, email);

    const category = await createCategory(page, 'Partial Test');
    await addItem(category, 'Ultralight Tent Stakes', { description: 'Titanium' });
    await addItem(category, 'Heavy Hammer', { description: 'Steel' });

    await openSidebar(page);

    const searchInput = page.locator('#librarySearch');
    await searchInput.fill('Ultra');

    await expect(page.locator('#library').getByText('Ultralight Tent Stakes', { exact: true })).toBeVisible();
    await expect(page.locator('#library').getByText('Heavy Hammer', { exact: true })).toHaveCount(0);
  });

  test('should show all items when search is cleared', async ({ page }) => {
    const { username, password, email } = generateTestUser('libclear');

    await registerUser(page, username, password, email);

    const category = await createCategory(page, 'Clear Test');
    await addItem(category, 'Item Alpha');
    await addItem(category, 'Item Beta');
    await addItem(category, 'Item Gamma');

    await openSidebar(page);

    const searchInput = page.locator('#librarySearch');

    // Filter to one item
    await searchInput.fill('Alpha');
    await expect(page.locator('#library').getByText('Item Alpha', { exact: true })).toBeVisible();
    await expect(page.locator('#library').getByText('Item Beta', { exact: true })).toHaveCount(0);

    // Clear search
    await searchInput.clear();

    // All items should be visible again
    await expect(page.locator('#library').getByText('Item Alpha', { exact: true })).toBeVisible();
    await expect(page.locator('#library').getByText('Item Beta', { exact: true })).toBeVisible();
    await expect(page.locator('#library').getByText('Item Gamma', { exact: true })).toBeVisible();
  });

  test('should search by description text', async ({ page }) => {
    const { username, password, email } = generateTestUser('libdesc');

    await registerUser(page, username, password, email);

    const category = await createCategory(page, 'Description Test');
    await addItem(category, 'Generic Bag', { description: 'ultralight cuben fiber' });
    await addItem(category, 'Regular Pack', { description: 'standard nylon' });

    await openSidebar(page);

    const searchInput = page.locator('#librarySearch');
    await searchInput.fill('cuben');

    await expect(page.locator('#library').getByText('Generic Bag', { exact: true })).toBeVisible();
    await expect(page.locator('#library').getByText('Regular Pack', { exact: true })).toHaveCount(0);
  });

  test('should show empty state when no items match search', async ({ page }) => {
    const { username, password, email } = generateTestUser('libempty');

    await registerUser(page, username, password, email);

    const category = await createCategory(page, 'Empty Test');
    await addItem(category, 'Real Item');

    await openSidebar(page);

    const searchInput = page.locator('#librarySearch');
    await searchInput.fill('nonexistent12345');

    // The item should not be visible
    await expect(page.locator('#library').getByText('Real Item', { exact: true })).toHaveCount(0);
  });
});

test.describe('Library Item Management', () => {
  test('should delete a library item', async ({ page }) => {
    const { username, password, email } = generateTestUser('libdelete');

    await registerUser(page, username, password, email);

    const category = await createCategory(page, 'Delete Gear');
    await addItem(category, 'Delete Me Item', { description: 'To be removed' });

    await openSidebar(page);

    const libraryItem = page.locator('#library').getByText('Delete Me Item', { exact: true }).locator('..');
    await libraryItem.hover();
    await libraryItem.getByTitle('Delete this item permanently').click();

    await page.getByRole('button', { name: 'Yes' }).click();
    await expect(page.locator('#library').getByText('Delete Me Item', { exact: true })).toHaveCount(0);
  });

  test('should cancel library item deletion', async ({ page }) => {
    const { username, password, email } = generateTestUser('libcancel');

    await registerUser(page, username, password, email);

    const category = await createCategory(page, 'Cancel Delete');
    await addItem(category, 'Keep This Item');

    await openSidebar(page);

    const libraryItem = page.locator('#library').getByText('Keep This Item', { exact: true }).locator('..');
    await libraryItem.hover();
    await libraryItem.getByTitle('Delete this item permanently').click();

    await page.getByRole('button', { name: 'No' }).click();

    // Item should still exist
    await expect(page.locator('#library').getByText('Keep This Item', { exact: true })).toBeVisible();
  });

  test('should show library items from all lists', async ({ page }) => {
    const { username, password, email } = generateTestUser('liball');

    await registerUser(page, username, password, email);

    // Create items in different categories
    const category1 = await createCategory(page, 'Shelter');
    await addItem(category1, 'Tent from Shelter');

    const category2 = await createCategory(page, 'Sleep');
    await addItem(category2, 'Bag from Sleep');

    await openSidebar(page);

    // Both items should appear in library
    await expect(page.locator('#library').getByText('Tent from Shelter', { exact: true })).toBeVisible();
    await expect(page.locator('#library').getByText('Bag from Sleep', { exact: true })).toBeVisible();
  });

  test('should update library when item is edited', async ({ page }) => {
    const { username, password, email } = generateTestUser('libedit');

    await registerUser(page, username, password, email);

    const category = await createCategory(page, 'Edit Test');
    const itemRow = await addItem(category, 'Original Name');

    await openSidebar(page);

    // Verify original name in library
    await expect(page.locator('#library').getByText('Original Name', { exact: true })).toBeVisible();

    // Edit item name in the category
    await itemRow.getByPlaceholder('Name', { exact: true }).fill('Updated Name');
    await itemRow.getByPlaceholder('Name', { exact: true }).blur();

    // Library should reflect the change
    await expect(page.locator('#library').getByText('Updated Name', { exact: true })).toBeVisible();
    await expect(page.locator('#library').getByText('Original Name', { exact: true })).toHaveCount(0);
  });
});
