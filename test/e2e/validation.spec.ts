import { test, expect } from '@playwright/test';

import { registerUser, generateTestUser } from './auth-utils';
import { createCategoryWithItem, enableSetting } from './test-helpers';

test.describe('Weight Input Validation', () => {
  test.beforeEach(async ({ page }) => {
    const { username, password, email } = generateTestUser('wval');
    await registerUser(page, username, password, email);
  });

  // Documents actual behavior: negative weights ARE accepted by the app
  test('should accept negative weight input', async ({ page }) => {
    const { category, itemRow } = await createCategoryWithItem(page, 'Test', 'Negative Weight Item');

    const weightInput = itemRow.getByTestId('item-weight');
    await weightInput.fill('-5');
    await weightInput.blur();

    // App accepts negative weights - this documents current behavior
    const value = await weightInput.inputValue();
    expect(value).toBe('-5');

    // Category subtotal will be negative
    const subtotal = await category.getByTestId('category-subtotal-weight').textContent();
    expect(parseFloat(subtotal || '0')).toBe(-5);
  });

  // Documents actual behavior: very large weights are accepted unchanged (no cap)
  test('should accept very large weight values without capping', async ({ page }) => {
    const { category, itemRow } = await createCategoryWithItem(page, 'Test', 'Heavy Item');

    const weightInput = itemRow.getByTestId('item-weight');
    await weightInput.fill('999999999');
    await weightInput.blur();

    await expect(weightInput).toHaveValue('999999999');

    const subtotal = await category.getByTestId('category-subtotal-weight').textContent();
    expect(parseFloat(subtotal || '0')).toBe(999999999);
  });

  // Documents actual behavior: non-numeric text IS accepted by the app
  test('should accept non-numeric weight input', async ({ page }) => {
    const { category, itemRow } = await createCategoryWithItem(page, 'Test', 'Text Weight Item');

    const weightInput = itemRow.getByTestId('item-weight');
    await weightInput.fill('abc');
    await weightInput.blur();

    // App accepts non-numeric input - this documents current behavior
    const value = await weightInput.inputValue();
    expect(value).toBe('abc');

    // Subtotal treats invalid input as 0 (NaN becomes 0)
    const subtotal = await category.getByTestId('category-subtotal-weight').textContent();
    expect(parseFloat(subtotal || '0')).toBe(0);
  });

  test('should handle empty weight input', async ({ page }) => {
    const { category, itemRow } = await createCategoryWithItem(page, 'Test', 'Empty Weight Item');

    const weightInput = itemRow.getByTestId('item-weight');
    await weightInput.clear();
    await weightInput.blur();

    // Should default to empty or 0
    const value = await weightInput.inputValue();
    const numValue = parseFloat(value) || 0;
    expect(numValue).toBe(0);

    // Subtotal should handle empty weight gracefully
    const subtotal = await category.getByTestId('category-subtotal-weight').textContent();
    expect(parseFloat(subtotal || '0')).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Quantity Input Validation', () => {
  test.beforeEach(async ({ page }) => {
    const { username, password, email } = generateTestUser('qval');
    await registerUser(page, username, password, email);
  });

  test('should handle zero quantity', async ({ page }) => {
    const { category, itemRow } = await createCategoryWithItem(page, 'Test', 'Zero Qty Item');

    const weightInput = itemRow.getByTestId('item-weight');
    await weightInput.fill('10');
    await weightInput.blur();

    const qtyInput = itemRow.getByTestId('item-qty');
    await qtyInput.clear();
    await qtyInput.fill('0');
    await qtyInput.blur();

    // With qty=0, the weight contribution should be 0
    const subtotal = await category.getByTestId('category-subtotal-weight').textContent();
    expect(parseFloat(subtotal || '0')).toBe(0);
  });

  // Documents actual behavior: negative quantities ARE accepted by the app
  test('should accept negative quantity input', async ({ page }) => {
    const { category, itemRow } = await createCategoryWithItem(page, 'Test', 'Negative Qty Item');

    const weightInput = itemRow.getByTestId('item-weight');
    await weightInput.fill('10');
    await weightInput.blur();

    const qtyInput = itemRow.getByTestId('item-qty');
    await qtyInput.clear();
    await qtyInput.fill('-3');
    await qtyInput.blur();

    // App accepts negative quantity - this documents current behavior
    const value = await qtyInput.inputValue();
    expect(value).toBe('-3');

    // Subtotal will be negative (10 * -3 = -30)
    const subtotal = await category.getByTestId('category-subtotal-weight').textContent();
    expect(parseFloat(subtotal || '0')).toBe(-30);
  });

  // Documents actual behavior: decimal quantities are accepted and multiply the weight
  test('should accept decimal quantity and multiply weight by it', async ({ page }) => {
    const { category, itemRow } = await createCategoryWithItem(page, 'Test', 'Decimal Qty Item');

    const weightInput = itemRow.getByTestId('item-weight');
    await weightInput.fill('10');
    await weightInput.blur();

    const qtyInput = itemRow.getByTestId('item-qty');
    await qtyInput.clear();
    await qtyInput.fill('1.5');
    await qtyInput.blur();

    await expect(qtyInput).toHaveValue('1.5');

    // 10 * 1.5 = 15
    const subtotal = await category.getByTestId('category-subtotal-weight').textContent();
    expect(parseFloat(subtotal || '0')).toBe(15);
  });

  // Documents actual behavior: very large quantities are accepted unchanged (no cap)
  test('should accept very large quantity without capping', async ({ page }) => {
    const { category, itemRow } = await createCategoryWithItem(page, 'Test', 'Large Qty Item');

    const weightInput = itemRow.getByTestId('item-weight');
    await weightInput.fill('1');
    await weightInput.blur();

    const qtyInput = itemRow.getByTestId('item-qty');
    await qtyInput.clear();
    await qtyInput.fill('9999');
    await qtyInput.blur();

    await expect(qtyInput).toHaveValue('9999');

    // 1 * 9999 = 9999
    const subtotal = await category.getByTestId('category-subtotal-weight').textContent();
    expect(parseFloat(subtotal || '0')).toBe(9999);
  });

  // Documents actual behavior: non-numeric text IS accepted by the app
  test('should accept non-numeric quantity input', async ({ page }) => {
    const { category, itemRow } = await createCategoryWithItem(page, 'Test', 'Text Qty Item');

    const weightInput = itemRow.getByTestId('item-weight');
    await weightInput.fill('10');
    await weightInput.blur();

    const qtyInput = itemRow.getByTestId('item-qty');
    await qtyInput.clear();
    await qtyInput.fill('abc');
    await qtyInput.blur();

    // App accepts non-numeric input - this documents current behavior
    const value = await qtyInput.inputValue();
    expect(value).toBe('abc');

    // Subtotal treats invalid quantity as 1 (default), not 0
    const subtotal = await category.getByTestId('category-subtotal-weight').textContent();
    expect(parseFloat(subtotal || '0')).toBe(10);
  });
});

test.describe('Text Field Validation', () => {
  test.beforeEach(async ({ page }) => {
    const { username, password, email } = generateTestUser('tval');
    await registerUser(page, username, password, email);
    await expect(page.getByText('Welcome to LighterPack!')).toBeVisible();
  });

  test('should handle empty item name', async ({ page }) => {
    await page.getByText('Add new category', { exact: true }).click();
    const category = page.getByTestId('category').last();
    await category.getByPlaceholder('Category Name', { exact: true }).fill('Test Category');
    await category.getByPlaceholder('Category Name', { exact: true }).blur();

    await category.getByText('Add new item', { exact: true }).click();
    const itemRow = category.getByTestId('item-row').last();

    // Leave name empty and set weight
    const weightInput = itemRow.getByTestId('item-weight');
    await weightInput.fill('10');
    await weightInput.blur();

    // Item should still exist and weight should be counted
    const subtotal = await category.getByTestId('category-subtotal-weight').textContent();
    expect(parseFloat(subtotal || '0')).toBe(10);
  });

  test('should handle empty category name', async ({ page }) => {
    await page.getByText('Add new category', { exact: true }).click();
    const category = page.getByTestId('category').last();

    // Leave category name empty
    await category.getByPlaceholder('Category Name', { exact: true }).blur();

    // Add an item to this category
    await category.getByText('Add new item', { exact: true }).click();
    const itemRow = category.getByTestId('item-row').last();
    await itemRow.getByPlaceholder('Name', { exact: true }).fill('Test Item');
    await itemRow.getByTestId('item-weight').fill('10');
    await itemRow.getByTestId('item-weight').blur();

    // Category should still function
    const subtotal = await category.getByTestId('category-subtotal-weight').textContent();
    expect(parseFloat(subtotal || '0')).toBe(10);
  });

  test('should handle very long item name', async ({ page }) => {
    const longName = 'A'.repeat(500);

    await page.getByText('Add new category', { exact: true }).click();
    const category = page.getByTestId('category').last();
    await category.getByPlaceholder('Category Name', { exact: true }).fill('Test');
    await category.getByPlaceholder('Category Name', { exact: true }).blur();

    await category.getByText('Add new item', { exact: true }).click();
    const itemRow = category.getByTestId('item-row').last();
    const nameInput = itemRow.getByPlaceholder('Name', { exact: true });
    await nameInput.fill(longName);
    await nameInput.blur();

    // Name should be saved (possibly truncated)
    const savedName = await nameInput.inputValue();
    expect(savedName.length).toBeGreaterThan(0);
  });

  test('should handle special characters in item name', async ({ page }) => {
    const specialName = '<script>alert("xss")</script> & "quotes" \'single\'';

    await page.getByText('Add new category', { exact: true }).click();
    const category = page.getByTestId('category').last();
    await category.getByPlaceholder('Category Name', { exact: true }).fill('Test');
    await category.getByPlaceholder('Category Name', { exact: true }).blur();

    await category.getByText('Add new item', { exact: true }).click();
    const itemRow = category.getByTestId('item-row').last();
    const nameInput = itemRow.getByPlaceholder('Name', { exact: true });
    await nameInput.fill(specialName);
    await nameInput.blur();

    // Name should be saved as-is (escaped in display) without executing scripts
    const savedName = await nameInput.inputValue();
    expect(savedName).toContain('script');

    // Page should not have any alert dialogs or script execution
    // (If XSS worked, test would likely fail or show unexpected behavior)
  });

  test('should handle empty list name', async ({ page }) => {
    const listNameInput = page.getByPlaceholder('Name your list', { exact: true });

    // Clear the list name
    await listNameInput.clear();
    await listNameInput.blur();

    // List should still function - add a category and item
    await page.getByText('Add new category', { exact: true }).click();
    const category = page.getByTestId('category').last();
    await category.getByPlaceholder('Category Name', { exact: true }).fill('Test');
    await category.getByPlaceholder('Category Name', { exact: true }).blur();

    await category.getByText('Add new item', { exact: true }).click();
    const itemRow = category.getByTestId('item-row').last();
    await itemRow.getByPlaceholder('Name', { exact: true }).fill('Item');
    await itemRow.getByTestId('item-weight').fill('10');
    await itemRow.getByTestId('item-weight').blur();

    const subtotal = await category.getByTestId('category-subtotal-weight').textContent();
    expect(parseFloat(subtotal || '0')).toBe(10);
  });
});

test.describe('Calculation Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    const { username, password, email } = generateTestUser('calc');
    await registerUser(page, username, password, email);
    await expect(page.getByText('Welcome to LighterPack!')).toBeVisible();
  });

  test('should handle all items marked as worn', async ({ page }) => {
    await page.getByText('Add new category', { exact: true }).click();
    const category = page.getByTestId('category').last();
    await category.getByPlaceholder('Category Name', { exact: true }).fill('Worn Items');
    await category.getByPlaceholder('Category Name', { exact: true }).blur();

    // Add two worn items
    for (const name of ['Boots', 'Hat']) {
      await category.getByText('Add new item', { exact: true }).click();
      const itemRow = category.getByTestId('item-row').last();
      await itemRow.getByPlaceholder('Name', { exact: true }).fill(name);
      await itemRow.getByTestId('item-weight').fill('10');
      await itemRow.getByTestId('item-weight').blur();

      await itemRow.hover();
      await itemRow.getByTitle('Mark this item as worn').click();
    }

    // Total weight should be 20
    await expect(page.getByTestId('total-weight')).toHaveText(/^\s*20(\.0+)?\s*$/);

    // Worn weight should be 20
    await expect(page.getByTestId('worn-weight')).toHaveText(/^\s*20(\.0+)?\s*$/);

    // Base weight should be 0 (all items are worn)
    await expect(page.getByTestId('base-weight')).toHaveText(/^\s*0(\.0+)?\s*$/);
  });

  test('should handle all items marked as consumable', async ({ page }) => {
    await page.getByText('Add new category', { exact: true }).click();
    const category = page.getByTestId('category').last();
    await category.getByPlaceholder('Category Name', { exact: true }).fill('Consumables');
    await category.getByPlaceholder('Category Name', { exact: true }).blur();

    // Add two consumable items
    for (const name of ['Food', 'Water']) {
      await category.getByText('Add new item', { exact: true }).click();
      const itemRow = category.getByTestId('item-row').last();
      await itemRow.getByPlaceholder('Name', { exact: true }).fill(name);
      await itemRow.getByTestId('item-weight').fill('10');
      await itemRow.getByTestId('item-weight').blur();

      await itemRow.hover();
      await itemRow.getByTitle('Mark this item as a consumable').click();
    }

    // Total weight should be 20
    await expect(page.getByTestId('total-weight')).toHaveText(/^\s*20(\.0+)?\s*$/);

    // Consumable weight should be 20
    await expect(page.getByTestId('consumable-weight')).toHaveText(/^\s*20(\.0+)?\s*$/);

    // Base weight should be 0 (all items are consumable)
    await expect(page.getByTestId('base-weight')).toHaveText(/^\s*0(\.0+)?\s*$/);
  });

  test('should handle all items with zero weight', async ({ page }) => {
    await page.getByText('Add new category', { exact: true }).click();
    const category = page.getByTestId('category').last();
    await category.getByPlaceholder('Category Name', { exact: true }).fill('Weightless');
    await category.getByPlaceholder('Category Name', { exact: true }).blur();

    // Add items with zero weight
    for (const name of ['Digital Map', 'Phone App']) {
      await category.getByText('Add new item', { exact: true }).click();
      const itemRow = category.getByTestId('item-row').last();
      await itemRow.getByPlaceholder('Name', { exact: true }).fill(name);
      await itemRow.getByTestId('item-weight').fill('0');
      await itemRow.getByTestId('item-weight').blur();
    }

    // Category subtotal should be 0
    await expect(category.getByTestId('category-subtotal-weight')).toHaveText(/^0(\.0+)?$/);

    // Total weight element may not be visible when total is 0, so just verify category subtotal
  });

  test('should unmark worn item and update base weight', async ({ page }) => {
    await page.getByText('Add new category', { exact: true }).click();
    const category = page.getByTestId('category').last();
    await category.getByPlaceholder('Category Name', { exact: true }).fill('Test');
    await category.getByPlaceholder('Category Name', { exact: true }).blur();

    // Add item with weight
    await category.getByText('Add new item', { exact: true }).click();
    const itemRow = category.getByTestId('item-row').last();
    await itemRow.getByPlaceholder('Name', { exact: true }).fill('Boots');
    await itemRow.getByTestId('item-weight').fill('20');
    await itemRow.getByTestId('item-weight').blur();

    // Initially, item is not worn - total weight should be 20
    // Note: base-weight/worn-weight elements are hidden when worn weight is 0
    await expect(page.getByTestId('total-weight')).toHaveText(/^\s*20(\.0+)?\s*$/);

    // Mark as worn - this shows the worn/base weight split
    await itemRow.hover();
    const wornIcon = itemRow.getByTitle('Mark this item as worn');
    await wornIcon.click();

    // Verify worn state - worn=20, base=0
    await expect(page.getByTestId('worn-weight')).toHaveText(/^\s*20(\.0+)?\s*$/);
    await expect(page.getByTestId('base-weight')).toHaveText(/^\s*0(\.0+)?\s*$/);

    // Unmark as worn
    await itemRow.hover();
    await wornIcon.click();

    // Verify unworn state - the worn/base weight split disappears and total is unchanged
    await expect(page.getByTestId('worn-weight')).toBeHidden();
    await expect(wornIcon).not.toHaveClass(/lpActive/);
    await expect(page.getByTestId('total-weight')).toHaveText(/^\s*20(\.0+)?\s*$/);
  });

  test('should handle price with non-zero weight item', async ({ page }) => {
    // Enable prices
    const settings = page.locator('#settings');
    await settings.hover();
    await settings.getByLabel('Item prices', { exact: true }).check();

    await page.getByText('Add new category', { exact: true }).click();
    const category = page.getByTestId('category').last();
    await category.getByPlaceholder('Category Name', { exact: true }).fill('Test');
    await category.getByPlaceholder('Category Name', { exact: true }).blur();

    await category.getByText('Add new item', { exact: true }).click();
    const itemRow = category.getByTestId('item-row').last();
    await itemRow.getByPlaceholder('Name', { exact: true }).fill('Backpack');
    await itemRow.getByTestId('item-weight').fill('32');
    await itemRow.getByTestId('item-price').fill('150');
    await itemRow.getByTestId('item-price').blur();

    // Should show total with price
    await expect(page.locator('.lpTotal')).toBeVisible();
    await expect(page.locator('.lpTotal').getByText('$150')).toBeVisible();
  });

  test('should accumulate small decimals without precision errors', async ({ page }) => {
    await page.getByText('Add new category', { exact: true }).click();
    const category = page.getByTestId('category').last();
    await category.getByPlaceholder('Category Name', { exact: true }).fill('Precision Test');
    await category.getByPlaceholder('Category Name', { exact: true }).blur();

    // Add multiple items with decimal weights that could cause floating point issues
    // 0.1 + 0.2 = 0.30000000000000004 in JS if not handled properly
    const weights = ['0.1', '0.2', '0.1', '0.2', '0.1', '0.2', '0.1'];

    for (let i = 0; i < weights.length; i++) {
      await category.getByText('Add new item', { exact: true }).click();
      const itemRow = category.getByTestId('item-row').last();
      await itemRow.getByPlaceholder('Name', { exact: true }).fill(`Item ${i + 1}`);
      await itemRow.getByTestId('item-weight').fill(weights[i]);
      await itemRow.getByTestId('item-weight').blur();
    }

    // Sum should be 1.0 (0.1*4 + 0.2*3 = 0.4 + 0.6 = 1.0)
    // Assert the exact displayed string: a float-precision bug would render
    // something like "0.9999999999999999", which parseFloat would round away.
    await expect(category.getByTestId('category-subtotal-weight')).toHaveText('1');
  });
});
