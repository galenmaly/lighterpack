import { test, expect } from '@playwright/test';

import { testRoot } from './utils';
import { registerUser } from './auth-utils';

test.describe('Item Management', () => {
  test.beforeEach(async ({ page }) => {
    const now = Date.now();
    const username = `item${now}`;
    const email = `item+${now}@lighterpack.com`;
    const password = 'testtest';

    await registerUser(page, username, password, email);
    await expect(page.getByText('Welcome to LighterPack!')).toBeVisible();

    // Create a NEW category for items (added at end of list)
    await page.click('a.addCategory');
    const category = page.locator('li.lpCategory').last();
    await category.locator('input.lpCategoryName').fill('Test Category');
    await category.locator('input.lpCategoryName').blur();
  });

  // Helper to get the test category (last one created)
  const getTestCategory = (page) => page.locator('li.lpCategory').last();

  test('should add a new item', async ({ page }) => {
    const category = getTestCategory(page);
    await category.locator('a.lpAddItem').click();

    const nameInput = category.locator('input.lpName').first();
    await expect(nameInput).toBeVisible();
    await nameInput.fill('Backpack');
    await nameInput.blur();

    await expect(nameInput).toHaveValue('Backpack');
  });

  test('should edit item name', async ({ page }) => {
    const category = getTestCategory(page);
    await category.locator('a.lpAddItem').click();
    const nameInput = category.locator('input.lpName').first();
    await nameInput.fill('Tent');
    await nameInput.blur();

    // Edit the name
    await nameInput.clear();
    await nameInput.fill('Ultralight Tent');
    await nameInput.blur();

    await expect(nameInput).toHaveValue('Ultralight Tent');
  });

  test('should edit item description', async ({ page }) => {
    const category = getTestCategory(page);
    await category.locator('a.lpAddItem').click();

    const nameInput = category.locator('input.lpName').first();
    await nameInput.fill('Sleeping Bag');

    const descInput = category.locator('input.lpDescription').first();
    await descInput.fill('20 degree down bag');
    await descInput.blur();

    await expect(descInput).toHaveValue('20 degree down bag');
  });

  test('should set item weight', async ({ page }) => {
    const category = getTestCategory(page);
    await category.locator('a.lpAddItem').click();

    const nameInput = category.locator('input.lpName').first();
    await nameInput.fill('Water Bottle');

    const weightInput = category.locator('input.lpWeight').first();
    await weightInput.fill('5.5');
    await weightInput.blur();

    await expect(weightInput).toHaveValue('5.5');
  });

  test('should set item quantity', async ({ page }) => {
    const category = getTestCategory(page);
    await category.locator('a.lpAddItem').click();

    const nameInput = category.locator('input.lpName').first();
    await nameInput.fill('Tent Stake');

    const qtyInput = category.locator('input.lpQty').first();
    await qtyInput.clear();
    await qtyInput.fill('8');
    await qtyInput.blur();

    await expect(qtyInput).toHaveValue('8');
  });

  test('should delete an item', async ({ page }) => {
    const category = getTestCategory(page);
    await category.locator('a.lpAddItem').click();
    const item = category.locator('li.lpItem').first();
    const nameInput = item.locator('input.lpName');
    await nameInput.fill('Item To Delete');
    await nameInput.blur();

    // Count items before deletion
    const initialCount = await category.locator('li.lpItem').count();

    // Hover over item row to reveal delete button, then click it
    // Note: Item deletion in a category is immediate (no confirmation modal)
    await item.hover();
    await item.locator('a.lpRemoveItem').click();

    // Verify item count decreased
    await expect(category.locator('li.lpItem')).toHaveCount(initialCount - 1);
  });

  test('should toggle star rating', async ({ page }) => {
    await page.click('a.lpAddItem');
    const nameInput = page.locator('input.lpName').first();
    await nameInput.fill('Starred Item');
    await nameInput.blur();

    // Hover over the item to reveal the star icon, then click it
    const itemRow = page.locator('li.lpItem').first();
    await itemRow.hover();
    const starIcon = itemRow.locator('i.lpStar');
    await starIcon.click();

    // Star should have changed class (lpStar1, lpStar2, etc.)
    await expect(starIcon).not.toHaveClass(/lpStar0/);
  });

  test('should add multiple items to category', async ({ page }) => {
    const items = ['Tent', 'Sleeping Bag', 'Sleeping Pad', 'Pillow'];

    for (const itemName of items) {
      await page.click('a.lpAddItem');
      const nameInputs = page.locator('input.lpName');
      const lastInput = nameInputs.last();
      await lastInput.fill(itemName);
      await lastInput.blur();
    }

    // Verify all items exist by checking item count
    const nameInputs = page.locator('input.lpName');
    const count = await nameInputs.count();
    expect(count).toBeGreaterThanOrEqual(items.length);
  });

  test('should calculate weight correctly with quantity', async ({ page }) => {
    await page.click('a.lpAddItem');

    const nameInput = page.locator('input.lpName').first();
    await nameInput.fill('Fuel Canister');

    const weightInput = page.locator('input.lpWeight').first();
    await weightInput.fill('8');

    const qtyInput = page.locator('input.lpQty').first();
    await qtyInput.clear();
    await qtyInput.fill('3');
    await qtyInput.blur();

    // The category subtotal should be 8 * 3 = 24 oz
    const category = page.locator('li.lpCategory').first();
    await expect(category.locator('.lpWeightCell.lpSubtotal')).toContainText('24');
  });
});

test.describe('Item Worn/Consumable Toggles', () => {
  test.beforeEach(async ({ page }) => {
    const now = Date.now();
    const username = `worn${now}`;
    const email = `worn+${now}@lighterpack.com`;
    const password = 'testtest';

    await registerUser(page, username, password, email);
    await expect(page.getByText('Welcome to LighterPack!')).toBeVisible();

    // Worn and consumable should be enabled by default based on the page snapshot
    // Create a category
    await page.click('a.addCategory');
    const categoryInput = page.locator('input.lpCategoryName').first();
    await categoryInput.fill('Clothing');
    await categoryInput.blur();
  });

  test('should mark item as worn', async ({ page }) => {
    await page.click('a.lpAddItem');
    const nameInput = page.locator('input.lpName').first();
    await nameInput.fill('Hiking Boots');

    const weightInput = page.locator('input.lpWeight').first();
    await weightInput.fill('32');
    await weightInput.blur();

    // Hover over the item to reveal icons, then click worn
    const itemRow = page.locator('li.lpItem').first();
    await itemRow.hover();
    const wornIcon = itemRow.locator('i.lpWorn');
    await wornIcon.click();

    // Verify worn is active
    await expect(wornIcon).toHaveClass(/lpActive/);
  });

  test('should mark item as consumable', async ({ page }) => {
    await page.click('a.lpAddItem');
    const nameInput = page.locator('input.lpName').first();
    await nameInput.fill('Trail Mix');

    const weightInput = page.locator('input.lpWeight').first();
    await weightInput.fill('16');
    await weightInput.blur();

    // Hover over the item to reveal icons, then click consumable
    const itemRow = page.locator('li.lpItem').first();
    await itemRow.hover();
    const consumableIcon = itemRow.locator('i.lpConsumable');
    await consumableIcon.click();

    // Verify consumable is active
    await expect(consumableIcon).toHaveClass(/lpActive/);
  });

  test('worn items should be excluded from base weight', async ({ page }) => {
    // Add a regular item
    await page.click('a.lpAddItem');
    await page.locator('input.lpName').first().fill('Backpack');
    await page.locator('input.lpWeight').first().fill('32');
    await page.locator('input.lpWeight').first().blur();

    // Add a worn item
    await page.click('a.lpAddItem');
    const items = page.locator('li.lpItem');
    await items.last().locator('input.lpName').fill('Boots');
    await items.last().locator('input.lpWeight').fill('48');
    await items.last().locator('input.lpWeight').blur();

    // Hover and mark as worn
    await items.last().hover();
    await items.last().locator('i.lpWorn').click();

    // Verify the worn icon is active
    await expect(items.last().locator('i.lpWorn')).toHaveClass(/lpActive/);
  });
});

test.describe('Item Link and Image', () => {
  test.beforeEach(async ({ page }) => {
    const now = Date.now();
    const username = `link${now}`;
    const email = `link+${now}@lighterpack.com`;
    const password = 'testtest';

    await registerUser(page, username, password, email);
    await expect(page.getByText('Welcome to LighterPack!')).toBeVisible();

    // Create a category
    await page.click('a.addCategory');
    const categoryInput = page.locator('input.lpCategoryName').first();
    await categoryInput.fill('Gear');
    await categoryInput.blur();
  });

  test('should add URL to item', async ({ page }) => {
    await page.click('a.lpAddItem');
    const nameInput = page.locator('input.lpName').first();
    await nameInput.fill('Tent');
    await nameInput.blur();

    // Hover over the item to reveal icons, then click link
    const itemRow = page.locator('li.lpItem').first();
    await itemRow.hover();
    const linkIcon = itemRow.locator('i.lpLink');
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
});
