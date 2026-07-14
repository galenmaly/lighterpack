import { test, expect } from '@playwright/test';

import { registerUser, generateTestUser } from './auth-utils';
import { createCategory, addItem } from './test-helpers';

test.describe('Weight Units', () => {
  test.beforeEach(async ({ page }) => {
    const { username, password, email } = generateTestUser('wt');

    await registerUser(page, username, password, email);
    await expect(page.getByText('Welcome to LighterPack!')).toBeVisible();

    // Create a category with an item
    const category = await createCategory(page, 'Test Category');
    await addItem(category, 'Test Item');
  });

  test('should default to ounces (oz)', async ({ page }) => {
    const unitDisplay = page.getByTestId('unit-select').first().locator('span.lpDisplay');
    await expect(unitDisplay).toHaveText('oz');
  });

  test('should change unit through lb, g, and kg', async ({ page }) => {
    const unitSelect = page.getByTestId('unit-select').first();
    const unitDisplay = unitSelect.locator('span.lpDisplay');

    for (const unit of ['lb', 'g', 'kg'] as const) {
      await unitSelect.click();
      await page.locator(`ul.lpUnitDropdown li.${unit}`).first().click();
      await expect(unitDisplay).toHaveText(unit);
    }
  });

  test('should save weight with unit', async ({ page }) => {
    const category = page.getByTestId('category').first();
    const itemRow = category.getByTestId('item-row').last();
    const weightInput = itemRow.getByTestId('item-weight');
    const unitSelect = itemRow.getByTestId('unit-select');

    await weightInput.fill('2.5');
    await weightInput.blur();

    // Change to pounds
    await unitSelect.click();
    await itemRow.locator('ul.lpUnitDropdown li.lb').click();

    // Verify unit display shows lb
    const unitDisplay = unitSelect.locator('span.lpDisplay');
    await expect(unitDisplay).toHaveText('lb');

    // Verify weight value is still 2.5
    await expect(weightInput).toHaveValue('2.5');

    // Verify category subtotal reflects the weight in lb (2.5 lb = 40 oz)
    await expect(category.getByTestId('category-subtotal-weight')).toHaveText(/^40(\.0+)?$/);
  });
});

test.describe('Weight Calculations', () => {
  test.beforeEach(async ({ page }) => {
    const { username, password, email } = generateTestUser('calc');

    await registerUser(page, username, password, email);
    await expect(page.getByText('Welcome to LighterPack!')).toBeVisible();
  });

  test('should calculate category subtotal', async ({ page }) => {
    const category = await createCategory(page, 'Shelter');
    await addItem(category, 'Tent', { weight: '32' });
    await addItem(category, 'Footprint', { weight: '16' });

    // Subtotal should be 48 oz
    await expect(category.getByTestId('category-subtotal-weight')).toHaveText(/^48(\.0+)?$/);
  });

  test('should calculate total weight across categories', async ({ page }) => {
    const firstCategory = await createCategory(page, 'Shelter');
    await addItem(firstCategory, 'Tent', { weight: '32' });

    const secondCategory = await createCategory(page, 'Sleep');
    await addItem(secondCategory, 'Sleeping Bag', { weight: '28' });

    // Total should be 60 oz
    await expect(page.getByTestId('total-weight')).toHaveText(/^\s*60(\.0+)?\s*$/);
  });

  test('should convert total weight when total unit changes', async ({ page }) => {
    const category = await createCategory(page, 'Unit Conversion');
    await addItem(category, 'Fuel', { weight: '16' });

    const totalUnitSelect = page.locator('.lpTotalUnit').getByTestId('unit-select');
    await totalUnitSelect.click();
    await page.locator('ul.lpUnitDropdown li.lb').first().click();

    await expect(page.getByTestId('total-weight')).toHaveText(/^\s*1(\.0+)?\s*$/);
  });

  test('should sum mixed item units correctly', async ({ page }) => {
    const category = await createCategory(page, 'Mixed Units');

    // Add first item: 1 lb (use returned locator since createCategory adds a default item)
    const itemOne = await addItem(category, 'Item LB', { weight: '1', unit: 'lb' });

    // Verify first item is in lb
    await expect(itemOne.getByTestId('unit-select').locator('span.lpDisplay')).toHaveText('lb');

    // Add second item: 16 oz
    const itemTwo = await addItem(category, 'Item OZ', { weight: '16', unit: 'oz' });

    // Verify second item is in oz
    await expect(itemTwo.getByTestId('unit-select').locator('span.lpDisplay')).toHaveText('oz');

    // Total should be 1 lb + 16 oz = 16 oz + 16 oz = 32 oz
    await expect(page.getByTestId('total-weight')).toHaveText(/^\s*32(\.0+)?\s*$/);
  });

  test('should handle quantity multiplier in calculations', async ({ page }) => {
    const category = await createCategory(page, 'Food');
    await addItem(category, 'Energy Bar', { weight: '2', quantity: '10' });

    // Subtotal should be 2 * 10 = 20 oz
    await expect(category.getByTestId('category-subtotal-weight')).toHaveText(/^20(\.0+)?$/);
  });

  test('should update totals when item deleted', async ({ page }) => {
    const category = await createCategory(page, 'Gear');
    const firstItem = await addItem(category, 'Item 1', { weight: '10' });
    await addItem(category, 'Item 2', { weight: '20' });

    // Verify subtotal is 30
    await expect(category.getByTestId('category-subtotal-weight')).toHaveText(/^30(\.0+)?$/);

    // Delete first item (Item 1 with 10 oz) - hover first to reveal button
    await firstItem.hover();
    await firstItem.getByTitle('Remove this item').click();

    // Subtotal should now be 20 (only Item 2 remains)
    await expect(category.getByTestId('category-subtotal-weight')).toHaveText(/^20(\.0+)?$/);
  });
});

test.describe('Weight Input Behavior', () => {
  test.beforeEach(async ({ page }) => {
    const { username, password, email } = generateTestUser('inp');

    await registerUser(page, username, password, email);
    await expect(page.getByText('Welcome to LighterPack!')).toBeVisible();

    const category = await createCategory(page, 'Test');
    await addItem(category, 'Test Item');
  });

  test('should round weight display to two decimals', async ({ page }) => {
    const weightInput = page.getByTestId('item-row').last().getByTestId('item-weight');
    await weightInput.fill('0.335');
    await weightInput.blur();

    await expect(weightInput).toHaveValue('0.34');
  });
});
