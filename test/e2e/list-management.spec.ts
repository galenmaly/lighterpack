import { test, expect } from '@playwright/test';

import { registerUser, generateTestUser } from './auth-utils';
import { openSidebar, dragListItem, createCategoryWithItem } from './test-helpers';

test.describe('List Management', () => {
  test('should create, rename, and switch between lists', async ({ page }) => {
    const { username, password, email } = generateTestUser('lists');

    await registerUser(page, username, password, email);
    await openSidebar(page);

    const listNameInput = page.getByPlaceholder('List Name', { exact: true });
    await listNameInput.fill('Base List');
    await listNameInput.blur();

    await page.getByTestId('new-list').click();
    await listNameInput.fill('Trip List');
    await listNameInput.blur();

    const listItems = page.locator('#lists').getByRole('listitem');
    await expect(listItems.filter({ hasText: 'Base List' })).toHaveCount(1);
    await expect(listItems.filter({ hasText: 'Trip List' })).toHaveCount(1);

    await page.locator('#lists').getByText('Base List', { exact: true }).click();
    await expect(listNameInput).toHaveValue('Base List');

    await page.locator('#lists').getByText('Trip List', { exact: true }).click();
    await expect(listNameInput).toHaveValue('Trip List');
  });

  test('should reorder lists via drag handle', async ({ page }) => {
    const { username, password, email } = generateTestUser('listorder');

    await registerUser(page, username, password, email);
    await openSidebar(page);

    const listNameInput = page.getByPlaceholder('List Name', { exact: true });
    await listNameInput.fill('List One');
    await listNameInput.blur();

    await page.getByTestId('new-list').click();
    await listNameInput.fill('List Two');
    await listNameInput.blur();

    const listItems = page.locator('#lists').getByRole('listitem');
    await expect(listItems).toHaveCount(2);

    const firstList = listItems.nth(0);
    const secondList = listItems.nth(1);

    await dragListItem(page, secondList, firstList);

    const listNames = await page.locator('#lists .lpListName').allTextContents();
    expect(listNames[0].trim()).toBe('List Two');
  });

  test('should copy a list from the sidebar menu', async ({ page }) => {
    const { username, password, email } = generateTestUser('listcopy');

    await registerUser(page, username, password, email);
    await openSidebar(page);

    const listNameInput = page.getByPlaceholder('List Name', { exact: true });
    await listNameInput.fill('Original List');
    await listNameInput.blur();

    await page.getByTestId('new-list').hover();
    await page.getByText('Copy a list', { exact: true }).click();

    const listToCopy = page.locator('#listToCopy');
    await expect(listToCopy).toBeVisible();
    await listToCopy.selectOption({ label: 'Original List' });

    await page.locator('#copyConfirm').click();

    await expect(page.locator('#lists').getByText('Copy of Original List', { exact: true })).toHaveCount(1);
    await expect(listNameInput).toHaveValue('Copy of Original List');
  });

  test('should keep copied list items linked to the original list items', async ({ page }) => {
    const { username, password, email } = generateTestUser('listlink');

    await registerUser(page, username, password, email);
    await openSidebar(page);

    const listNameInput = page.getByPlaceholder('List Name', { exact: true });
    await listNameInput.fill('Linked List');
    await listNameInput.blur();

    await createCategoryWithItem(page, 'Shelter', 'Old Tent');

    await page.getByTestId('new-list').hover();
    await page.getByText('Copy a list', { exact: true }).click();

    const listToCopy = page.locator('#listToCopy');
    await expect(listToCopy).toBeVisible();
    await listToCopy.selectOption({ label: 'Linked List' });
    await page.locator('#copyConfirm').click();

    const copiedListName = 'Copy of Linked List';
    await expect(page.locator('#lists').getByText(copiedListName, { exact: true })).toHaveCount(1);
    await expect(listNameInput).toHaveValue(copiedListName);

    const copiedItem = page.getByTestId('item-row').first();
    const copiedItemName = copiedItem.getByPlaceholder('Name', { exact: true });
    await copiedItemName.fill('New Tent Name');
    await copiedItemName.blur();

    await page.locator('#lists').getByText('Linked List', { exact: true }).click();
    await expect(listNameInput).toHaveValue('Linked List');

    const originalItemName = page.getByTestId('item-row').first().getByPlaceholder('Name', { exact: true });
    await expect(originalItemName).toHaveValue('New Tent Name');
  });

  test('should not remove original list items when deleting from copied list', async ({ page }) => {
    const { username, password, email } = generateTestUser('listunlink');

    await registerUser(page, username, password, email);
    await openSidebar(page);

    const listNameInput = page.getByPlaceholder('List Name', { exact: true });
    await listNameInput.fill('Linked Delete');
    await listNameInput.blur();

    await createCategoryWithItem(page, 'Shared Category', 'Shared Item');

    await page.getByTestId('new-list').hover();
    await page.getByText('Copy a list', { exact: true }).click();

    const listToCopy = page.locator('#listToCopy');
    await expect(listToCopy).toBeVisible();
    await listToCopy.selectOption({ label: 'Linked Delete' });
    await page.locator('#copyConfirm').click();

    await expect(listNameInput).toHaveValue('Copy of Linked Delete');

    const copiedCategories = page.getByTestId('category');
    const copiedCategoryIndex = await copiedCategories.evaluateAll((nodes) =>
      nodes.findIndex((node) => {
        const input = node.querySelector('input.lpCategoryName');
        return input && input.value === 'Shared Category';
      }),
    );
    expect(copiedCategoryIndex).toBeGreaterThanOrEqual(0);
    const copiedCategoryNode = copiedCategories.nth(copiedCategoryIndex);
    await expect(copiedCategoryNode.locator('input.lpCategoryName')).toHaveValue('Shared Category');

    const copiedItemIndex = await copiedCategoryNode.getByTestId('item-row').evaluateAll((nodes) =>
      nodes.findIndex((node) => {
        const input = node.querySelector('input.lpName');
        return input && input.value === 'Shared Item';
      }),
    );
    expect(copiedItemIndex).toBeGreaterThanOrEqual(0);
    const copiedItem = copiedCategoryNode.getByTestId('item-row').nth(copiedItemIndex);
    await copiedItem.hover();
    await copiedItem.getByTitle('Remove this item').click();

    await page.locator('#lists').getByText('Linked Delete', { exact: true }).click();
    await expect(listNameInput).toHaveValue('Linked Delete');

    const originalCategories = page.getByTestId('category');
    const originalCategoryIndex = await originalCategories.evaluateAll((nodes) =>
      nodes.findIndex((node) => {
        const input = node.querySelector('input.lpCategoryName');
        return input && input.value === 'Shared Category';
      }),
    );
    expect(originalCategoryIndex).toBeGreaterThanOrEqual(0);
    const originalCategoryNode = originalCategories.nth(originalCategoryIndex);
    const originalItemNames = await originalCategoryNode.getByTestId('item-row').evaluateAll((nodes) =>
      nodes.map((node) => {
        const input = node.querySelector('input.lpName');
        return input ? input.value : '';
      }),
    );
    expect(originalItemNames).toContain('Shared Item');
  });

  test('should delete a non-active list', async ({ page }) => {
    const { username, password, email } = generateTestUser('listdel');

    await registerUser(page, username, password, email);
    await openSidebar(page);

    const listNameInput = page.getByPlaceholder('List Name', { exact: true });
    await listNameInput.fill('Keep List');
    await listNameInput.blur();

    await page.getByTestId('new-list').click();
    await listNameInput.fill('Delete Me');
    await listNameInput.blur();

    await page.locator('#lists').getByText('Keep List', { exact: true }).click();

    const deleteListItem = page.locator('#lists').getByRole('listitem').filter({ hasText: 'Delete Me' });
    await deleteListItem.hover();
    await deleteListItem.getByTitle('Remove this list').click();
    await page.getByRole('button', { name: 'Yes' }).click();

    await expect(page.locator('#lists').getByText('Delete Me', { exact: true })).toHaveCount(0);
  });
});

test.describe('List Settings', () => {
  test('should toggle list description visibility', async ({ page }) => {
    const { username, password, email } = generateTestUser('desc');

    await registerUser(page, username, password, email);

    const settings = page.locator('#settings');
    await settings.hover();
    const listDescriptionToggle = settings.getByLabel('List descriptions', { exact: true });

    await listDescriptionToggle.check();
    await expect(page.getByRole('heading', { name: 'List Description' })).toBeVisible();
    await expect(page.locator('#listDescription')).toBeVisible();

    await settings.hover();
    await listDescriptionToggle.uncheck();
    await expect(page.getByRole('heading', { name: 'List Description' })).toHaveCount(0);
  });

  test('should show item price fields when enabled', async ({ page }) => {
    const { username, password, email } = generateTestUser('price');

    await registerUser(page, username, password, email);
    await createCategoryWithItem(page, 'Gear', 'Backpack');

    const settings = page.locator('#settings');
    await settings.hover();
    const priceToggle = settings.getByLabel('Item prices', { exact: true });
    await priceToggle.check();

    await expect(page.locator('#currencySymbol')).toBeVisible();
    await expect(page.getByTestId('item-price').first()).toBeVisible();
  });

  test('should hide worn/consumable controls when disabled', async ({ page }) => {
    const { username, password, email } = generateTestUser('toggles');

    await registerUser(page, username, password, email);
    await createCategoryWithItem(page, 'Clothing', 'Boots');

    const settings = page.locator('#settings');
    await settings.hover();
    await settings.getByLabel('Worn items', { exact: true }).uncheck();
    await settings.getByLabel('Consumable items', { exact: true }).uncheck();

    const itemRow = page.getByTestId('item-row').last();
    await expect(itemRow.getByTitle('Mark this item as worn')).toHaveCount(0);
    await expect(itemRow.getByTitle('Mark this item as a consumable')).toHaveCount(0);
  });

  test('should persist settings after reload', async ({ page }) => {
    const { username, password, email } = generateTestUser('persist');

    await registerUser(page, username, password, email);
    await createCategoryWithItem(page, 'Gear', 'Backpack');

    const settings = page.locator('#settings');
    await settings.hover();
    await settings.getByLabel('Item prices', { exact: true }).check();
    await settings.getByLabel('List descriptions', { exact: true }).check();

    const listDescription = page.locator('#listDescription');
    await expect(listDescription).toBeVisible();

    const currencyInput = page.locator('#currencySymbol');
    await expect(currencyInput).toBeVisible();
    await currencyInput.fill('€');
    await currencyInput.blur();

    // Wait for auto-save to complete (app saves after 10s of inactivity)
    await page.waitForResponse(
      (response) => response.url().includes('saveLibrary') && response.status() === 200,
      { timeout: 15000 },
    );
    await page.reload();
    await expect(page.getByText('Welcome to LighterPack!')).toBeVisible();

    await page.locator('#settings').hover();
    await expect(page.locator('#currencySymbol')).toHaveValue('€');
    await expect(page.locator('#listDescription')).toBeVisible();
    await expect(page.getByTestId('item-price').first()).toBeVisible();
  });

  test('should update total price when prices are enabled', async ({ page }) => {
    const { username, password, email } = generateTestUser('price-total');

    await registerUser(page, username, password, email);
    await createCategoryWithItem(page, 'Food', 'Energy Bar');

    const settings = page.locator('#settings');
    await settings.hover();
    await settings.getByLabel('Item prices', { exact: true }).check();

    const itemRow = page.getByTestId('item-row').last();
    await itemRow.getByTestId('item-weight').fill('1');
    await itemRow.getByTestId('item-weight').blur();

    const priceInput = itemRow.getByTestId('item-price');
    await priceInput.fill('3.5');
    await priceInput.blur();

    await expect(page.getByText('Total', { exact: true })).toBeVisible();
    await expect(page.locator('.lpTotal').getByText('$3.50')).toBeVisible();
  });

  test('should show category price subtotal and consumable price total', async ({ page }) => {
    const { username, password, email } = generateTestUser('price-breakdown');

    await registerUser(page, username, password, email);
    const { category, itemRow } = await createCategoryWithItem(page, 'Food', 'Trail Mix');

    const settings = page.locator('#settings');
    await settings.hover();
    await settings.getByLabel('Item prices', { exact: true }).check();
    await settings.getByLabel('Consumable items', { exact: true }).check();

    await itemRow.getByTestId('item-weight').fill('4');
    await itemRow.getByTestId('item-weight').blur();
    await itemRow.getByTestId('item-price').fill('2.5');
    await itemRow.getByTestId('item-price').blur();

    await itemRow.hover();
    await itemRow.getByTitle('Mark this item as a consumable').click();

    await expect(page.locator('.lpTotal').getByText('$2.50')).toBeVisible();
    await expect(page.locator('.lpConsumableWeight').getByText('$2.50')).toBeVisible();

    // Use the category locator from createCategoryWithItem to ensure we're checking the right category
    const categorySubtotalPrice = category.locator('.lpPriceCell.lpSubtotal');
    await expect(categorySubtotalPrice).toContainText('$2.50');
  });
});
