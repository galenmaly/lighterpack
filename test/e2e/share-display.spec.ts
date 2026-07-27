import { test, expect } from '@playwright/test';

import { registerUser, generateTestUser } from './auth-utils';
import {
  createCategory,
  addItem,
  enableSetting,
  markItemAsWorn,
  markItemAsConsumable,
  setItemStarRating,
} from './test-helpers';

/**
 * Supplements share-view.spec.ts with:
 *   - star ratings 0, 2, 3  (share-view.spec.ts only covers star 1)
 *   - category subtotal qty and price
 *   - totals table: per-category rows, total qty, total price, unit label
 *
 * Test data (all weights in oz):
 *   Tent         8 oz × 1  Shelter   price $100  2 stars  "Double-wall tent"
 *   Rain Jacket  4 oz × 2  Clothing  worn        3 stars
 *   Socks        1 oz × 3  Clothing  consumable  0 stars
 *   Trail Mix    2 oz × 1  Food      consumable  price $5
 *   ──────────────────────────────────────────────────────────────────────
 *   Total 21 oz | Worn 8 oz | Consumable 5 oz | Base 8 oz
 *   Total qty 7 | Total price $105
 *
 *   Shelter subtotal:  8 oz  qty 1  price $100
 *   Clothing subtotal: 11 oz qty 5
 *   Food subtotal:     2 oz  qty 1  price $5
 */

test.describe('Share Page Extended Coverage', () => {
  let shareUrl: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    const { username, password, email } = generateTestUser('shdisp');
    await registerUser(page, username, password, email);
    await expect(page.getByText('Add new category', { exact: true })).toBeVisible();

    // Enable optional fields that affect the share page layout
    await enableSetting(page, 'List descriptions');
    await enableSetting(page, 'Item prices');

    // Set list name
    const listNameInput = page.getByPlaceholder('Name your list', { exact: true });
    await listNameInput.fill('Trail Ready');
    await listNameInput.blur();

    // Shelter: Tent — 8 oz, qty 1, price $100, description "Double-wall tent", 2 stars
    const shelterCategory = await createCategory(page, 'Shelter');
    const tentRow = await addItem(shelterCategory, 'Tent', {
      weight: '8',
      description: 'Double-wall tent',
      price: '100',
    });
    await setItemStarRating(tentRow, 2);

    // Clothing: Rain Jacket — 4 oz, qty 2, worn, 3 stars
    const clothingCategory = await createCategory(page, 'Clothing');
    const jacketRow = await addItem(clothingCategory, 'Rain Jacket', {
      weight: '4',
      quantity: '2',
    });
    await markItemAsWorn(jacketRow);
    await setItemStarRating(jacketRow, 3);

    // Clothing: Socks — 1 oz, qty 3, consumable, 0 stars (default, never clicked)
    const socksRow = await addItem(clothingCategory, 'Socks', {
      weight: '1',
      quantity: '3',
    });
    await markItemAsConsumable(socksRow);

    // Food: Trail Mix — 2 oz, qty 1, consumable, price $5
    const foodCategory = await createCategory(page, 'Food');
    const trailMixRow = await addItem(foodCategory, 'Trail Mix', {
      weight: '2',
      price: '5',
    });
    await markItemAsConsumable(trailMixRow);

    // Retrieve share URL
    await page.getByText('Share', { exact: true }).hover();
    const shareUrlInput = page.getByLabel('Share your list');
    await expect(shareUrlInput).toHaveValue(/\/r\/[a-zA-Z0-9]+/, { timeout: 10000 });
    shareUrl = await shareUrlInput.inputValue();

    // Poll until the share endpoint returns 200
    await expect(async () => {
      const response = await page.request.get(shareUrl);
      expect(response.status()).toBe(200);
    }).toPass({ timeout: 30000 });

    await page.close();
  });

  // ── Star ratings ──────────────────────────────────────────────────────────

  test('star rating 2 should apply lpStar2 class', async ({ page }) => {
    await page.goto(shareUrl);
    const tentItem = page.locator('li.lpItem').filter({ hasText: 'Tent' });
    const starIcon = tentItem.locator('i.lpStar');
    await expect(starIcon).toHaveClass(/lpStar2/);
    await expect(starIcon).not.toHaveClass(/lpHidden/);
  });

  test('star rating 3 should apply lpStar3 class', async ({ page }) => {
    await page.goto(shareUrl);
    const jacketItem = page.locator('li.lpItem').filter({ hasText: 'Rain Jacket' });
    const starIcon = jacketItem.locator('i.lpStar');
    await expect(starIcon).toHaveClass(/lpStar3/);
    await expect(starIcon).not.toHaveClass(/lpHidden/);
  });

  test('star rating 0 should hide the star icon', async ({ page }) => {
    await page.goto(shareUrl);
    const socksItem = page.locator('li.lpItem').filter({ hasText: 'Socks' });
    await expect(socksItem.locator('i.lpStar')).toHaveClass(/lpHidden/);
  });

  // ── Category subtotals: qty and price ─────────────────────────────────────

  test('should display category subtotal qty', async ({ page }) => {
    await page.goto(shareUrl);

    // Each new category auto-creates one blank item (qty 1) in addition to explicitly added items.
    // Shelter: 1 blank + Tent (qty 1) = 2
    const shelterCategory = page
      .locator('li.lpCategory')
      .filter({ has: page.locator('h2', { hasText: 'Shelter' }) });
    await expect(shelterCategory.locator('.lpItemsHeader .lpQtySubtotal')).toHaveText('2');

    // Clothing: 1 blank + Rain Jacket (qty 2) + Socks (qty 3) = 6
    const clothingCategory = page
      .locator('li.lpCategory')
      .filter({ has: page.locator('h2', { hasText: 'Clothing' }) });
    await expect(clothingCategory.locator('.lpItemsHeader .lpQtySubtotal')).toHaveText('6');

    // Food: 1 blank + Trail Mix (qty 1) = 2
    const foodCategory = page
      .locator('li.lpCategory')
      .filter({ has: page.locator('h2', { hasText: 'Food' }) });
    await expect(foodCategory.locator('.lpItemsHeader .lpQtySubtotal')).toHaveText('2');
  });

  test('should display category subtotal price', async ({ page }) => {
    await page.goto(shareUrl);

    const shelterCategory = page
      .locator('li.lpCategory')
      .filter({ has: page.locator('h2', { hasText: 'Shelter' }) });
    await expect(shelterCategory.locator('.lpItemsHeader .lpPriceCell')).toContainText('100');

    const foodCategory = page
      .locator('li.lpCategory')
      .filter({ has: page.locator('h2', { hasText: 'Food' }) });
    await expect(foodCategory.locator('.lpItemsHeader .lpPriceCell')).toContainText('5');
  });

  // ── Totals table ──────────────────────────────────────────────────────────

  test('totals table should list each category by name', async ({ page }) => {
    await page.goto(shareUrl);
    const totalsTable = page.locator('.lpTotals');
    await expect(totalsTable.locator('.lpTotalCategory').filter({ hasText: 'Shelter' })).toBeVisible();
    await expect(totalsTable.locator('.lpTotalCategory').filter({ hasText: 'Clothing' })).toBeVisible();
    await expect(totalsTable.locator('.lpTotalCategory').filter({ hasText: 'Food' })).toBeVisible();
  });

  test('totals table should show per-category weight', async ({ page }) => {
    await page.goto(shareUrl);
    const totalsTable = page.locator('.lpTotals');

    await expect(
      totalsTable.locator('.lpTotalCategory').filter({ hasText: 'Shelter' }).locator('.lpDisplaySubtotal'),
    ).toHaveText('8');
    await expect(
      totalsTable.locator('.lpTotalCategory').filter({ hasText: 'Clothing' }).locator('.lpDisplaySubtotal'),
    ).toHaveText('11');
    await expect(
      totalsTable.locator('.lpTotalCategory').filter({ hasText: 'Food' }).locator('.lpDisplaySubtotal'),
    ).toHaveText('2');
  });

  test('should display total item count via title attribute', async ({ page }) => {
    await page.goto(shareUrl);
    // totalQty is surfaced as a title attribute on .lpTotalValue.
    // Count: 1 original blank + Shelter(2) + Clothing(6) + Food(2) = 11
    // (Each created category auto-adds a blank item; the initial list also has a blank category+item.)
    await expect(page.locator('.lpTotalValue')).toHaveAttribute('title', '11 items');
  });

  test('should display total price', async ({ page }) => {
    await page.goto(shareUrl);
    // The total price cell carries the extra class "items" in the markup
    await expect(page.locator('.lpTotal .lpCell.items')).toContainText('105');
  });

  test('should display unit label in totals table category rows', async ({ page }) => {
    await page.goto(shareUrl);
    // Each category row in the totals table shows the unit next to its weight
    const shelterRow = page.locator('.lpTotalCategory').filter({ hasText: 'Shelter' });
    await expect(shelterRow.locator('.lpSubtotalUnit')).toContainText('oz');
  });
});
