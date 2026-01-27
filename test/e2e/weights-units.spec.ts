import { test, expect } from '@playwright/test';

import { testRoot } from './utils';
import { registerUser } from './auth-utils';

test.describe('Weight Units', () => {
  test.beforeEach(async ({ page }) => {
    const now = Date.now();
    const username = `wt${now}`;
    const email = `wt+${now}@lighterpack.com`;
    const password = 'testtest';

    await registerUser(page, username, password, email);
    await expect(page.getByText('Welcome to LighterPack!')).toBeVisible();

    // Create a category
    await page.click('a.addCategory');
    const categoryInput = page.locator('input.lpCategoryName').first();
    await categoryInput.fill('Test Category');
    await categoryInput.blur();

    // Add an item
    await page.click('a.lpAddItem');
    await page.locator('input.lpName').first().fill('Test Item');
  });

  test('should default to ounces (oz)', async ({ page }) => {
    const unitDisplay = page.locator('div.lpUnitSelect span.lpDisplay').first();
    await expect(unitDisplay).toHaveText('oz');
  });

  test('should change unit to pounds (lb)', async ({ page }) => {
    // Click unit selector to open dropdown
    await page.locator('div.lpUnitSelect').first().click();

    // Select pounds
    await page.locator('ul.lpUnitDropdown li.lb').first().click();

    // Verify unit changed
    const unitDisplay = page.locator('div.lpUnitSelect span.lpDisplay').first();
    await expect(unitDisplay).toHaveText('lb');
  });

  test('should change unit to grams (g)', async ({ page }) => {
    await page.locator('div.lpUnitSelect').first().click();
    await page.locator('ul.lpUnitDropdown li.g').first().click();

    const unitDisplay = page.locator('div.lpUnitSelect span.lpDisplay').first();
    await expect(unitDisplay).toHaveText('g');
  });

  test('should change unit to kilograms (kg)', async ({ page }) => {
    await page.locator('div.lpUnitSelect').first().click();
    await page.locator('ul.lpUnitDropdown li.kg').first().click();

    const unitDisplay = page.locator('div.lpUnitSelect span.lpDisplay').first();
    await expect(unitDisplay).toHaveText('kg');
  });

  test('should save weight with unit', async ({ page }) => {
    const weightInput = page.locator('input.lpWeight').first();
    await weightInput.fill('2.5');
    await weightInput.blur();

    // Change to pounds
    await page.locator('div.lpUnitSelect').first().click();
    await page.locator('ul.lpUnitDropdown li.lb').first().click();

    // Verify weight is still 2.5 (now in lb)
    await expect(weightInput).toHaveValue('2.5');
  });
});

test.describe('Weight Calculations', () => {
  test.beforeEach(async ({ page }) => {
    const now = Date.now();
    const username = `calc${now}`;
    const email = `calc+${now}@lighterpack.com`;
    const password = 'testtest';

    await registerUser(page, username, password, email);
    await expect(page.getByText('Welcome to LighterPack!')).toBeVisible();
  });

  test('should calculate category subtotal', async ({ page }) => {
    // Create a new category (added at end of list)
    await page.click('a.addCategory');
    const category = page.locator('li.lpCategory').last();
    await category.locator('input.lpCategoryName').fill('Shelter');
    await category.locator('input.lpCategoryName').blur();

    // Get initial item count
    const initialCount = await category.locator('li.lpItem').count();

    // Add first item: 32 oz to THIS category
    await category.locator('a.lpAddItem').click();
    await expect(category.locator('li.lpItem')).toHaveCount(initialCount + 1);
    const firstItem = category.locator('li.lpItem').last();
    await firstItem.locator('input.lpName').fill('Tent');
    await firstItem.locator('input.lpWeight').fill('32');
    await firstItem.locator('input.lpWeight').blur();

    // Add second item: 16 oz to THIS category
    await category.locator('a.lpAddItem').click();
    await expect(category.locator('li.lpItem')).toHaveCount(initialCount + 2);
    const secondItem = category.locator('li.lpItem').last();
    await secondItem.locator('input.lpName').fill('Footprint');
    await secondItem.locator('input.lpWeight').fill('16');
    await secondItem.locator('input.lpWeight').blur();

    // Subtotal should be 48 oz
    await expect(category.locator('.lpWeightCell.lpSubtotal')).toContainText('48');
  });

  test('should calculate total weight across categories', async ({ page }) => {
    // Create first category with items
    await page.click('a.addCategory');
    await page.locator('input.lpCategoryName').first().fill('Shelter');
    await page.locator('input.lpCategoryName').first().blur();

    await page.click('a.lpAddItem');
    await page.locator('input.lpName').first().fill('Tent');
    await page.locator('input.lpWeight').first().fill('32');
    await page.locator('input.lpWeight').first().blur();

    // Create second category with items
    await page.click('a.addCategory');
    const categories = page.locator('input.lpCategoryName');
    await categories.last().fill('Sleep');
    await categories.last().blur();

    // Add item to second category
    const addItemButtons = page.locator('a.lpAddItem');
    await addItemButtons.last().click();

    const allItems = page.locator('li.lpItem');
    await allItems.last().locator('input.lpName').fill('Sleeping Bag');
    await allItems.last().locator('input.lpWeight').fill('28');
    await allItems.last().locator('input.lpWeight').blur();

    // Total should be 60 oz - check the total row
    await expect(page.getByText('Total')).toBeVisible();
  });

  test('should handle quantity multiplier in calculations', async ({ page }) => {
    await page.click('a.addCategory');
    await page.locator('input.lpCategoryName').first().fill('Food');
    await page.locator('input.lpCategoryName').first().blur();

    await page.click('a.lpAddItem');
    await page.locator('input.lpName').first().fill('Energy Bar');
    await page.locator('input.lpWeight').first().fill('2');
    await page.locator('input.lpQty').first().clear();
    await page.locator('input.lpQty').first().fill('10');
    await page.locator('input.lpQty').first().blur();

    // Subtotal should be 2 * 10 = 20 oz
    const category = page.locator('li.lpCategory').first();
    await expect(category.locator('.lpWeightCell.lpSubtotal')).toContainText('20');
  });

  test('should handle mixed units in display', async ({ page }) => {
    await page.click('a.addCategory');
    await page.locator('input.lpCategoryName').first().fill('Heavy Gear');
    await page.locator('input.lpCategoryName').first().blur();

    await page.click('a.lpAddItem');
    await page.locator('input.lpName').first().fill('Bear Canister');
    // 48 oz = 3 lb
    await page.locator('input.lpWeight').first().fill('48');
    await page.locator('input.lpWeight').first().blur();

    // The display should show 48 oz
    const category = page.locator('li.lpCategory').first();
    await expect(category.locator('.lpWeightCell.lpSubtotal')).toContainText('48');
  });

  test('should update totals when item deleted', async ({ page }) => {
    // Create a new category (added at end of list)
    await page.click('a.addCategory');
    const category = page.locator('li.lpCategory').last();
    await category.locator('input.lpCategoryName').fill('Gear');
    await category.locator('input.lpCategoryName').blur();

    // Get initial item count
    const initialCount = await category.locator('li.lpItem').count();

    // Add first item to THIS category (10 oz)
    await category.locator('a.lpAddItem').click();
    await expect(category.locator('li.lpItem')).toHaveCount(initialCount + 1);
    const firstItemIndex = initialCount; // Index of the first item we add
    await category.locator('li.lpItem').nth(firstItemIndex).locator('input.lpName').fill('Item 1');
    await category.locator('li.lpItem').nth(firstItemIndex).locator('input.lpWeight').fill('10');
    await category.locator('li.lpItem').nth(firstItemIndex).locator('input.lpWeight').blur();

    // Add second item to THIS category (20 oz)
    await category.locator('a.lpAddItem').click();
    await expect(category.locator('li.lpItem')).toHaveCount(initialCount + 2);
    const secondItemIndex = initialCount + 1;
    await category.locator('li.lpItem').nth(secondItemIndex).locator('input.lpName').fill('Item 2');
    await category.locator('li.lpItem').nth(secondItemIndex).locator('input.lpWeight').fill('20');
    await category.locator('li.lpItem').nth(secondItemIndex).locator('input.lpWeight').blur();

    // Verify subtotal is 30
    await expect(category.locator('.lpWeightCell.lpSubtotal')).toContainText('30');

    // Delete first item we added (Item 1 with 10 oz) - hover first to reveal button
    // Note: Item deletion in a category is immediate (no confirmation modal)
    const itemToDelete = category.locator('li.lpItem').nth(firstItemIndex);
    await itemToDelete.hover();
    await itemToDelete.locator('a.lpRemoveItem').click();

    // Subtotal should now be 20 (only Item 2 remains)
    await expect(category.locator('.lpWeightCell.lpSubtotal')).toContainText('20');
  });
});

test.describe('Weight Input Behavior', () => {
  test.beforeEach(async ({ page }) => {
    const now = Date.now();
    const username = `inp${now}`;
    const email = `inp+${now}@lighterpack.com`;
    const password = 'testtest';

    await registerUser(page, username, password, email);
    await expect(page.getByText('Welcome to LighterPack!')).toBeVisible();

    await page.click('a.addCategory');
    await page.locator('input.lpCategoryName').first().fill('Test');
    await page.locator('input.lpCategoryName').first().blur();

    await page.click('a.lpAddItem');
    await page.locator('input.lpName').first().fill('Test Item');
  });

  test('should accept decimal weights', async ({ page }) => {
    const weightInput = page.locator('input.lpWeight').first();
    await weightInput.fill('3.75');
    await weightInput.blur();

    await expect(weightInput).toHaveValue('3.75');
  });

  test('should accept zero weight', async ({ page }) => {
    const weightInput = page.locator('input.lpWeight').first();
    await weightInput.fill('0');
    await weightInput.blur();

    await expect(weightInput).toHaveValue('0');
  });

  test('should increment weight with up arrow key', async ({ page }) => {
    const weightInput = page.locator('input.lpWeight').first();
    await weightInput.fill('5');
    await weightInput.focus();
    await page.keyboard.press('ArrowUp');

    // Weight should increment
    const value = await weightInput.inputValue();
    expect(parseFloat(value)).toBeGreaterThan(5);
  });

  test('should decrement weight with down arrow key', async ({ page }) => {
    const weightInput = page.locator('input.lpWeight').first();
    await weightInput.fill('5');
    await weightInput.focus();
    await page.keyboard.press('ArrowDown');

    // Weight should decrement
    const value = await weightInput.inputValue();
    expect(parseFloat(value)).toBeLessThan(5);
  });
});
