import { test, expect } from '@playwright/test';

import { registerUser, generateTestUser } from './auth-utils';
import { createCategory, addItem, getCategoryNames } from './test-helpers';

test.describe('Category Management', () => {
  test.beforeEach(async ({ page }) => {
    const { username, password, email } = generateTestUser('cat');

    await registerUser(page, username, password, email);
    await expect(page.getByText('Welcome to LighterPack!')).toBeVisible();
  });

  test('should delete a category', async ({ page }) => {
    // Create a new category (added at end of list)
    const category = await createCategory(page, 'To Delete');

    // Count categories before deletion
    const initialCount = await page.getByTestId('category').count();

    // Hover over the category header to reveal delete button
    const categoryHeader = category.locator('li').first();
    await categoryHeader.hover();

    // Click the remove button within the hovered category
    await category.getByTitle('Remove this category').click();

    // Confirm deletion in speedbump modal
    await page.getByRole('button', { name: 'Yes' }).click();

    // Verify category count decreased
    await expect(page.getByTestId('category')).toHaveCount(initialCount - 1);
  });

  test('should create multiple categories', async ({ page }) => {
    const categoryNames = ['Shelter', 'Sleep System', 'Clothing', 'Food'];

    for (const name of categoryNames) {
      await createCategory(page, name);
    }

    // Verify all categories exist by checking category names
    const createdNames = await getCategoryNames(page);
    for (const name of categoryNames) {
      expect(createdNames).toContain(name);
    }
  });

  test('should show category subtotals', async ({ page }) => {
    // Create a category with item
    const category = await createCategory(page, 'Shelter');
    await addItem(category, 'Tent', { weight: '32' });

    // Check that subtotal shows the weight
    await expect(category.getByTestId('category-subtotal-weight')).toHaveText(/^32(\.0+)?$/);
  });

  test('should update totals when a category is deleted', async ({ page }) => {
    const categoryA = await createCategory(page, 'Alpha');
    await addItem(categoryA, 'Item A', { weight: '10' });

    const categoryB = await createCategory(page, 'Beta');
    await addItem(categoryB, 'Item B', { weight: '20' });

    await expect(page.getByTestId('total-weight')).toHaveText(/^\s*30(\.0+)?\s*$/);

    await categoryB.locator('.lpItemsHeader').hover();
    await categoryB.getByTitle('Remove this category').click();
    await page.getByRole('button', { name: 'Yes' }).click();

    await expect(page.getByTestId('total-weight')).toHaveText(/^\s*10(\.0+)?\s*$/);
  });
});
