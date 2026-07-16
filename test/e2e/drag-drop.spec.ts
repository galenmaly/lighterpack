import { test, expect } from '@playwright/test';

import { registerUser, generateTestUser } from './auth-utils';
import { openSidebar, dragHandleToTarget, getCategoryNames, getItemNames } from './test-helpers';

test.describe('Drag and Drop', () => {
  test('should reorder categories via drag handle', async ({ page }) => {
    const { username, password, email } = generateTestUser('catdrag');

    await registerUser(page, username, password, email);

    await page.getByText('Add new category', { exact: true }).click();
    await page.getByTestId('category').nth(0).getByPlaceholder('Category Name', { exact: true }).fill('Alpha');
    await page.getByTestId('category').nth(0).getByPlaceholder('Category Name', { exact: true }).blur();

    await page.getByText('Add new category', { exact: true }).click();
    await page.getByTestId('category').nth(1).getByPlaceholder('Category Name', { exact: true }).fill('Beta');
    await page.getByTestId('category').nth(1).getByPlaceholder('Category Name', { exact: true }).blur();

    const initialNames = await getCategoryNames(page);
    expect(initialNames.indexOf('Beta')).toBeGreaterThan(initialNames.indexOf('Alpha'));

    // nth() resolves stably at call time — avoids the stale-.last() bug where both
    // locators would resolve to Beta once two categories exist.
    const firstCategory = page.getByTestId('category').nth(0);
    const secondCategory = page.getByTestId('category').nth(1);
    const secondHandle = secondCategory.getByTitle('Reorder this category');
    await dragHandleToTarget(page, secondHandle, firstCategory, secondCategory.locator('.lpItemsHeader'), 'top');

    await expect.poll(async () => {
      const updatedNames = await getCategoryNames(page);
      return updatedNames.indexOf('Beta') < updatedNames.indexOf('Alpha');
    }).toBe(true);
  });

  test('should reorder items within a category', async ({ page }) => {
    const { username, password, email } = generateTestUser('itemdrag');

    await registerUser(page, username, password, email);

    await page.getByText('Add new category', { exact: true }).click();
    const category = page.getByTestId('category').nth(0);
    await category.getByPlaceholder('Category Name', { exact: true }).fill('Gear');
    await category.getByPlaceholder('Category Name', { exact: true }).blur();

    await category.getByText('Add new item', { exact: true }).click();
    await category.getByTestId('item-row').nth(0).getByPlaceholder('Name', { exact: true }).fill('Item One');
    await category.getByTestId('item-row').nth(0).getByPlaceholder('Name', { exact: true }).blur();

    await category.getByText('Add new item', { exact: true }).click();
    await category.getByTestId('item-row').nth(1).getByPlaceholder('Name', { exact: true }).fill('Item Two');
    await category.getByTestId('item-row').nth(1).getByPlaceholder('Name', { exact: true }).blur();

    const itemNames = await getItemNames(category);
    expect(itemNames.indexOf('Item Two')).toBeGreaterThan(itemNames.indexOf('Item One'));

    // nth() resolves stably — avoids the stale-.last() bug where both locators
    // would resolve to Item Two once two items exist.
    const firstItem = category.getByTestId('item-row').nth(0);
    const secondItem = category.getByTestId('item-row').nth(1);
    const secondHandle = secondItem.getByTitle('Reorder this item');
    await dragHandleToTarget(page, secondHandle, firstItem, secondItem, 'top');

    await expect.poll(async () => {
      const updatedItemNames = await getItemNames(category);
      return updatedItemNames.indexOf('Item Two') < updatedItemNames.indexOf('Item One');
    }).toBe(true);
  });

  test('should drag a library item into a category', async ({ page }) => {
    const { username, password, email } = generateTestUser('libdrag');

    await registerUser(page, username, password, email);
    await openSidebar(page);

    const listNameInput = page.getByPlaceholder('List Name', { exact: true });
    await listNameInput.fill('Base List');
    await listNameInput.blur();

    await page.getByTestId('new-list').click();
    await listNameInput.fill('Library Source');
    await listNameInput.blur();

    const sourceItem = page.getByTestId('item-row').first();
    await sourceItem.getByPlaceholder('Name', { exact: true }).fill('Library Item');
    await sourceItem.getByPlaceholder('Name', { exact: true }).blur();

    await page.locator('#lists').getByText('Base List', { exact: true }).click();
    await expect(listNameInput).toHaveValue('Base List');

    await page.getByText('Add new category', { exact: true }).click();
    const targetCategory = page.getByTestId('category').last();
    await targetCategory.getByPlaceholder('Category Name', { exact: true }).fill('Target');
    await targetCategory.getByPlaceholder('Category Name', { exact: true }).blur();

    const libraryItem = page.locator('#library .lpLibraryItem').filter({ hasText: 'Library Item' });
    await libraryItem.scrollIntoViewIfNeeded();
    const libraryHandle = libraryItem.getByTitle('Drag this item into your list');

    const targetItem = targetCategory.getByTestId('item-row').first();
    await dragHandleToTarget(page, libraryHandle, targetItem, libraryItem, 'bottom');

    await expect.poll(async () => {
      const targetItemNames = await getItemNames(targetCategory);
      return targetItemNames.includes('Library Item');
    }).toBe(true);
  });
});
