import { test, expect, Page, Locator } from '@playwright/test';

import { registerUser, generateTestUser } from './auth-utils';
import { createCategory, addItem, enableSetting, markItemAsWorn, markItemAsConsumable } from './test-helpers';

// Helper to get the test category (last one created)
const getTestCategory = (page: Page): Locator => page.getByTestId('category').last();

test.describe('Item Management', () => {
  test.beforeEach(async ({ page }) => {
    const { username, password, email } = generateTestUser('item');

    await registerUser(page, username, password, email);
    await expect(page.getByText('Welcome to LighterPack!')).toBeVisible();

    // Create a NEW category for items (added at end of list)
    await createCategory(page, 'Test Category');
  });

  test('item fields round-trip through the model, save, and reload', async ({ page }) => {
    await enableSetting(page, 'Item prices');

    const category = getTestCategory(page);
    await addItem(category, 'Tent ⛺', {
      description: '3-season, 2 person',
      weight: '40',
      unit: 'oz',
      quantity: '2',
      price: '150',
    });

    // The computed subtotal reflects the model, not just the input values
    await expect(category.getByTestId('category-subtotal-weight')).toHaveText(/^80(\.0+)?$/);

    // Wait for the real (10s-debounced) save to complete, then reload
    await page.waitForResponse(
      (response) => response.url().includes('saveLibrary') && response.status() === 200,
      { timeout: 15000 },
    );
    await page.reload();
    await expect(page.getByText('Add new category', { exact: true })).toBeVisible();

    const savedCategory = getTestCategory(page);
    const savedRow = savedCategory.getByTestId('item-row').last();
    await expect(savedRow.getByPlaceholder('Name', { exact: true })).toHaveValue('Tent ⛺');
    await expect(savedRow.getByPlaceholder('Description', { exact: true })).toHaveValue('3-season, 2 person');
    await expect(savedRow.getByTestId('item-weight')).toHaveValue('40');
    await expect(savedRow.getByTestId('item-qty')).toHaveValue('2');
    // prices are formatted to two decimals when loaded from a save
    await expect(savedRow.getByTestId('item-price')).toHaveValue('150.00');
    await expect(savedCategory.getByTestId('category-subtotal-weight')).toHaveText(/^80(\.0+)?$/);
  });

  test('should delete an item', async ({ page }) => {
    const category = getTestCategory(page);
    await category.getByText('Add new item', { exact: true }).click();
    const item = category.getByTestId('item-row').first();
    const nameInput = item.getByPlaceholder('Name');
    await nameInput.fill('Item To Delete');
    await nameInput.blur();

    // Count items before deletion
    const initialCount = await category.getByTestId('item-row').count();

    // Hover over item row to reveal delete button, then click it
    // Note: Item deletion in a category is immediate (no confirmation modal)
    await item.hover();
    await item.getByTitle('Remove this item').click();

    // Verify item count decreased
    await expect(category.getByTestId('item-row')).toHaveCount(initialCount - 1);
  });

  test('should toggle star rating', async ({ page }) => {
    const category = getTestCategory(page);
    await category.getByText('Add new item', { exact: true }).click();
    const nameInput = category.getByTestId('item-row').last().getByPlaceholder('Name');
    await nameInput.fill('Starred Item');
    await nameInput.blur();

    // Hover over the item to reveal the star icon
    const itemRow = category.getByTestId('item-row').first();
    await itemRow.hover();
    const starIcon = itemRow.getByTitle('Star this item');

    // Initially should be lpStar0 (no star)
    await expect(starIcon).toHaveClass(/lpStar0/);

    // Click once - should be lpStar1
    await starIcon.click();
    await expect(starIcon).toHaveClass(/lpStar1/);

    // Click again - should be lpStar2
    await starIcon.click();
    await expect(starIcon).toHaveClass(/lpStar2/);

    // Click again - should be lpStar3
    await starIcon.click();
    await expect(starIcon).toHaveClass(/lpStar3/);

    // Click again - should cycle back to lpStar0
    await starIcon.click();
    await expect(starIcon).toHaveClass(/lpStar0/);
  });

  test('should calculate weight correctly with quantity', async ({ page }) => {
    const category = getTestCategory(page);
    await category.getByText('Add new item', { exact: true }).click();

    const itemRow = category.getByTestId('item-row').last();
    const nameInput = itemRow.getByPlaceholder('Name');
    await nameInput.fill('Fuel Canister');

    const weightInput = itemRow.getByTestId('item-weight');
    await weightInput.fill('8');

    const qtyInput = itemRow.getByTestId('item-qty');
    await qtyInput.clear();
    await qtyInput.fill('3');
    await qtyInput.blur();

    // The category subtotal should be 8 * 3 = 24 oz
    await expect(category.getByTestId('category-subtotal-weight')).toHaveText(/^24(\.0+)?$/);
  });
});

test.describe('Item Worn/Consumable Toggles', () => {
  test.beforeEach(async ({ page }) => {
    const { username, password, email } = generateTestUser('worn');

    await registerUser(page, username, password, email);
    await expect(page.getByText('Welcome to LighterPack!')).toBeVisible();

    // Worn and consumable should be enabled by default
    // Create a category
    await createCategory(page, 'Clothing');
  });

  test('should mark item as worn', async ({ page }) => {
    const category = page.getByTestId('category').first();
    await category.getByText('Add new item', { exact: true }).click();
    const itemRow = category.getByTestId('item-row').last();
    const nameInput = itemRow.getByPlaceholder('Name');
    await nameInput.fill('Hiking Boots');

    const weightInput = itemRow.getByTestId('item-weight');
    await weightInput.fill('32');
    await weightInput.blur();

    // Hover over the item to reveal icons, then click worn
    await itemRow.hover();
    const wornIcon = itemRow.getByTitle('Mark this item as worn');
    await wornIcon.click();

    // Verify worn is active
    await expect(wornIcon).toHaveClass(/lpActive/);
  });

  test('should mark item as consumable', async ({ page }) => {
    const category = page.getByTestId('category').first();
    await category.getByText('Add new item', { exact: true }).click();
    const itemRow = category.getByTestId('item-row').last();
    const nameInput = itemRow.getByPlaceholder('Name');
    await nameInput.fill('Trail Mix');

    const weightInput = itemRow.getByTestId('item-weight');
    await weightInput.fill('16');
    await weightInput.blur();

    // Hover over the item to reveal icons, then click consumable
    await itemRow.hover();
    const consumableIcon = itemRow.getByTitle('Mark this item as a consumable');
    await consumableIcon.click();

    // Verify consumable is active
    await expect(consumableIcon).toHaveClass(/lpActive/);
  });

  test('should prevent consumable when worn is active', async ({ page }) => {
    const category = page.getByTestId('category').first();
    await category.getByText('Add new item', { exact: true }).click();
    const itemRow = category.getByTestId('item-row').last();
    await itemRow.getByPlaceholder('Name', { exact: true }).fill('Jacket');

    const weightInput = itemRow.getByTestId('item-weight');
    await weightInput.fill('12');
    await weightInput.blur();

    await itemRow.hover();
    const wornIcon = itemRow.getByTitle('Mark this item as worn');
    const consumableIcon = itemRow.getByTitle('Mark this item as a consumable');
    await wornIcon.click();

    await expect(wornIcon).toHaveClass(/lpActive/);
    await consumableIcon.click();
    await expect(consumableIcon).not.toHaveClass(/lpActive/);
  });

  test('should prevent worn when consumable is active', async ({ page }) => {
    const category = page.getByTestId('category').first();
    await category.getByText('Add new item', { exact: true }).click();
    const itemRow = category.getByTestId('item-row').last();
    await itemRow.getByPlaceholder('Name', { exact: true }).fill('Water');

    const weightInput = itemRow.getByTestId('item-weight');
    await weightInput.fill('16');
    await weightInput.blur();

    await itemRow.hover();
    const wornIcon = itemRow.getByTitle('Mark this item as worn');
    const consumableIcon = itemRow.getByTitle('Mark this item as a consumable');

    // Mark as consumable first
    await consumableIcon.click();
    await expect(consumableIcon).toHaveClass(/lpActive/);

    // Try to mark as worn - should not work
    await wornIcon.click();
    await expect(wornIcon).not.toHaveClass(/lpActive/);

    // Consumable should still be active
    await expect(consumableIcon).toHaveClass(/lpActive/);
  });

  test('should count only one worn item even with quantity > 1', async ({ page }) => {
    const category = page.getByTestId('category').first();
    await category.getByText('Add new item', { exact: true }).click();
    const itemRow = category.getByTestId('item-row').last();
    await itemRow.getByPlaceholder('Name', { exact: true }).fill('Socks');

    const weightInput = itemRow.getByTestId('item-weight');
    await weightInput.fill('10');
    await weightInput.blur();

    const qtyInput = itemRow.getByTestId('item-qty');
    await qtyInput.clear();
    await qtyInput.fill('3');
    await qtyInput.blur();

    await itemRow.hover();
    const wornIcon = itemRow.getByTitle('Mark this item as worn');
    await wornIcon.click();
    await expect(wornIcon).toHaveClass(/lpActive/);

    await expect(page.getByTestId('total-weight')).toHaveText(/^\s*30(\.0+)?\s*$/);
    await expect(page.getByTestId('worn-weight')).toHaveText(/^\s*10(\.0+)?\s*$/);
    await expect(page.getByTestId('base-weight')).toHaveText(/^\s*20(\.0+)?\s*$/);
  });

  test('worn items should be excluded from base weight', async ({ page }) => {
    const category = page.getByTestId('category').first();
    // Add a regular item
    await category.getByText('Add new item', { exact: true }).click();
    const firstItem = category.getByTestId('item-row').last();
    await firstItem.getByPlaceholder('Name').fill('Backpack');
    await firstItem.getByTestId('item-weight').fill('32');
    await firstItem.getByTestId('item-weight').blur();

    // Add a worn item
    await category.getByText('Add new item', { exact: true }).click();
    const items = category.getByTestId('item-row');
    await items.last().getByPlaceholder('Name').fill('Boots');
    await items.last().getByTestId('item-weight').fill('48');
    await items.last().getByTestId('item-weight').blur();

    // Hover and mark as worn
    await items.last().hover();
    await items.last().getByTitle('Mark this item as worn').click();

    // Verify the worn icon is active
    await expect(items.last().getByTitle('Mark this item as worn')).toHaveClass(/lpActive/);

    // Total weight should include worn + non-worn
    await expect(page.getByTestId('total-weight')).toHaveText(/^\s*80(\.0+)?\s*$/);

    // Worn weight should be listed separately
    await expect(page.getByTestId('worn-weight')).toHaveText(/^\s*48(\.0+)?\s*$/);

    // Base weight should exclude worn weight
    await expect(page.getByTestId('base-weight')).toHaveText(/^\s*32(\.0+)?\s*$/);
  });
});

test.describe('Item Link and Image', () => {
  test.beforeEach(async ({ page }) => {
    const { username, password, email } = generateTestUser('link');

    await registerUser(page, username, password, email);
    await expect(page.getByText('Welcome to LighterPack!')).toBeVisible();

    // Create a category
    await createCategory(page, 'Gear');
  });

  test('should add URL to item', async ({ page }) => {
    const category = page.getByTestId('category').first();
    await category.getByText('Add new item', { exact: true }).click();
    const itemRow = category.getByTestId('item-row').last();
    const nameInput = itemRow.getByPlaceholder('Name');
    await nameInput.fill('Tent');
    await nameInput.blur();

    // Hover over the item to reveal icons, then click link
    await itemRow.hover();
    const linkIcon = itemRow.getByTitle('Add a link for this item');
    await linkIcon.click();

    // A modal dialog appears for adding a link
    const modal = page.locator('#itemLinkDialog');
    await expect(modal).toBeVisible();

    const urlInput = modal.getByPlaceholder('Item Link');
    await urlInput.fill('https://example.com/tent');

    // Save the link
    await modal.locator('input[type="submit"]').click();

    // Modal should close
    await expect(modal).not.toBeVisible();

    // Link icon should now be active (has lpActive class)
    await itemRow.hover();
    await expect(linkIcon).toHaveClass(/lpActive/);
  });

  test('should remove URL from item', async ({ page }) => {
    const category = page.getByTestId('category').first();
    await category.getByText('Add new item', { exact: true }).click();
    const itemRow = category.getByTestId('item-row').last();
    const nameInput = itemRow.getByPlaceholder('Name');
    await nameInput.fill('Linked Item');
    await nameInput.blur();

    // Add a link first
    await itemRow.hover();
    const linkIcon = itemRow.getByTitle('Add a link for this item');
    await linkIcon.click();

    const modal = page.locator('#itemLinkDialog');
    await expect(modal).toBeVisible();

    await modal.getByPlaceholder('Item Link').fill('https://example.com/item');
    await modal.locator('input[type="submit"]').click();
    await expect(modal).not.toBeVisible();

    // Verify link is active
    await itemRow.hover();
    await expect(linkIcon).toHaveClass(/lpActive/);

    // Now remove the link
    await linkIcon.click();
    await expect(modal).toBeVisible();

    // Clear the URL field and save
    await modal.getByPlaceholder('Item Link').clear();
    await modal.locator('input[type="submit"]').click();
    await expect(modal).not.toBeVisible();

    // Link icon should no longer be active
    await itemRow.hover();
    await expect(linkIcon).not.toHaveClass(/lpActive/);
  });
});
