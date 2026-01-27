import { test, expect } from '@playwright/test';

import { testRoot } from './utils';
import { registerUser } from './auth-utils';

test.describe('Category Management', () => {
  test.beforeEach(async ({ page }) => {
    const now = Date.now();
    const username = `cat${now}`;
    const email = `cat+${now}@lighterpack.com`;
    const password = 'testtest';

    await registerUser(page, username, password, email);
    await expect(page.getByText('Welcome to LighterPack!')).toBeVisible();
  });

  test('should create a new category', async ({ page }) => {
    await page.click('a.addCategory');

    const categoryInput = page.locator('input.lpCategoryName').first();
    await expect(categoryInput).toBeVisible();
    await categoryInput.fill('Shelter');
    await categoryInput.blur();

    // Verify category appears by checking the input value
    await expect(categoryInput).toHaveValue('Shelter');
  });

  test('should edit category name', async ({ page }) => {
    // Create a category first
    await page.click('a.addCategory');
    const categoryInput = page.locator('input.lpCategoryName').first();
    await categoryInput.fill('Clothing');
    await categoryInput.blur();

    // Edit the name
    await categoryInput.clear();
    await categoryInput.fill('Sleep System');
    await categoryInput.blur();

    // Verify the name changed
    await expect(categoryInput).toHaveValue('Sleep System');
  });

  test('should delete a category', async ({ page }) => {
    // Create a new category (added at end of list)
    await page.click('a.addCategory');
    const category = page.locator('li.lpCategory').last();
    const categoryInput = category.locator('input.lpCategoryName');
    await categoryInput.fill('To Delete');
    await categoryInput.blur();

    // Count categories before deletion
    const initialCount = await page.locator('li.lpCategory').count();

    // Hover over the category header to reveal delete button
    const categoryHeader = category.locator('li.lpHeader');
    await categoryHeader.hover();

    // Click the remove button within the hovered category
    await categoryHeader.locator('a.lpRemoveCategory').click();

    // Confirm deletion in speedbump modal
    await page.locator('.lpModal button.lpButton').filter({ hasText: 'Yes' }).click();

    // Verify category count decreased
    await expect(page.locator('li.lpCategory')).toHaveCount(initialCount - 1);
  });

  test('should create multiple categories', async ({ page }) => {
    const categoryNames = ['Shelter', 'Sleep System', 'Clothing', 'Food'];

    for (const name of categoryNames) {
      await page.click('a.addCategory');
      const categoryInputs = page.locator('input.lpCategoryName');
      const lastInput = categoryInputs.last();
      await lastInput.fill(name);
      await lastInput.blur();
    }

    // Verify all categories exist by checking category count
    const categoryInputs = page.locator('input.lpCategoryName');
    const count = await categoryInputs.count();
    expect(count).toBeGreaterThanOrEqual(categoryNames.length);
  });

  test('should show category subtotals', async ({ page }) => {
    // Create a category
    await page.click('a.addCategory');
    const categoryInput = page.locator('input.lpCategoryName').first();
    await categoryInput.fill('Shelter');
    await categoryInput.blur();

    // Add an item with weight
    await page.click('a.lpAddItem');
    await page.locator('input.lpName').first().fill('Tent');
    await page.locator('input.lpWeight').first().fill('32');
    await page.locator('input.lpWeight').first().blur();

    // Check that subtotal shows the weight - use the weight cell specifically
    const category = page.locator('li.lpCategory').first();
    await expect(category.locator('.lpWeightCell.lpSubtotal')).toContainText('32');
  });

  test('should update subtotals when adding multiple items', async ({ page }) => {
    // Create a new category (added at end of list)
    await page.click('a.addCategory');
    const category = page.locator('li.lpCategory').last();
    await category.locator('input.lpCategoryName').fill('Gear');
    await category.locator('input.lpCategoryName').blur();

    // Get initial item count in this category
    const initialCount = await category.locator('li.lpItem').count();

    // Add first item to THIS category
    await category.locator('a.lpAddItem').click();
    await expect(category.locator('li.lpItem')).toHaveCount(initialCount + 1);
    const firstItem = category.locator('li.lpItem').last();
    await firstItem.locator('input.lpName').fill('Item 1');
    await firstItem.locator('input.lpWeight').fill('10');
    await firstItem.locator('input.lpWeight').blur();

    // Add second item to THIS category
    await category.locator('a.lpAddItem').click();
    await expect(category.locator('li.lpItem')).toHaveCount(initialCount + 2);
    const secondItem = category.locator('li.lpItem').last();
    await secondItem.locator('input.lpName').fill('Item 2');
    await secondItem.locator('input.lpWeight').fill('20');
    await secondItem.locator('input.lpWeight').blur();

    // Check that subtotal shows combined weight (30 oz)
    await expect(category.locator('.lpWeightCell.lpSubtotal')).toContainText('30');
  });

  test('should handle category with quantity items', async ({ page }) => {
    // Create a category
    await page.click('a.addCategory');
    const categoryInput = page.locator('input.lpCategoryName').first();
    await categoryInput.fill('Food');
    await categoryInput.blur();

    // Add an item with quantity
    await page.click('a.lpAddItem');
    await page.locator('input.lpName').first().fill('Energy Bar');
    await page.locator('input.lpWeight').first().fill('2');
    await page.locator('input.lpQty').first().fill('5');
    await page.locator('input.lpQty').first().blur();

    // Check that subtotal accounts for quantity (2 * 5 = 10 oz)
    const category = page.locator('li.lpCategory').first();
    await expect(category.locator('.lpWeightCell.lpSubtotal')).toContainText('10');
  });
});
