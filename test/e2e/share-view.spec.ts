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
 * Test data weights (all in oz for easy math):
 *   Tent      32 oz × 1 = 32 oz  (Shelter)
 *   Jacket    16 oz × 1 = 16 oz  (Clothing, worn)
 *   Energy Bar  4 oz × 5 = 20 oz (Food, consumable)
 *   ──────────────────────────────
 *   Total 68 oz  |  Worn 16 oz  |  Consumable 20 oz  |  Base 32 oz
 */

test.describe('Share View', () => {
  let shareUrl: string;
  let csvUrl: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    const { username, password, email } = generateTestUser('shareview');
    await registerUser(page, username, password, email);
    await expect(page.getByText('Add new category', { exact: true })).toBeVisible();

    // Enable optional settings before creating items so price inputs are available
    await enableSetting(page, 'List descriptions');
    await enableSetting(page, 'Item prices');

    // Set list name and description
    const listNameInput = page.getByPlaceholder('List Name', { exact: true });
    await listNameInput.fill('Glacier Peak');
    await listNameInput.blur();
    await page.locator('#listDescription').fill('A summer backpacking trip');

    // Shelter: Tent — 32 oz, qty 1, description, price $150, URL
    const shelterCategory = await createCategory(page, 'Shelter');
    const tentRow = await addItem(shelterCategory, 'Tent', {
      weight: '32',
      description: 'Ultralight shelter',
      price: '150',
    });
    await tentRow.hover();
    await tentRow.getByTitle('Add a link for this item').click();
    await page.getByPlaceholder('Item Link').fill('https://example.com/tent');
    await page.getByRole('button', { name: 'Save' }).click();

    // Clothing: Jacket — 16 oz, qty 1, worn, one star
    const clothingCategory = await createCategory(page, 'Clothing');
    const jacketRow = await addItem(clothingCategory, 'Jacket', { weight: '16' });
    await markItemAsWorn(jacketRow);
    await setItemStarRating(jacketRow, 1);

    // Food: Energy Bar — 4 oz, qty 5, consumable
    const foodCategory = await createCategory(page, 'Food');
    const energyBarRow = await addItem(foodCategory, 'Energy Bar', { weight: '4', quantity: '5' });
    await markItemAsConsumable(energyBarRow);

    // Retrieve share and CSV URLs from the Share popover
    await page.getByText('Share', { exact: true }).hover();
    const shareUrlInput = page.getByLabel('Share your list');
    await expect(shareUrlInput).toHaveValue(/\/r\/[a-zA-Z0-9]+/, { timeout: 10000 });
    shareUrl = await shareUrlInput.inputValue();
    csvUrl = (await page.locator('#csvUrl').getAttribute('href')) ?? '';

    // Poll until the share endpoint returns 200 (implicitly waits for saveLibrary)
    await expect(async () => {
      const response = await page.request.get(shareUrl);
      expect(response.status()).toBe(200);
    }).toPass({ timeout: 30000 });

    await page.close();
  });

  // ── List-level data ──────────────────────────────────────────────────────

  test('should display list name', async ({ page }) => {
    await page.goto(shareUrl);
    await expect(page.locator('h1.lpListName')).toHaveText('Glacier Peak');
  });

  test('should display list description', async ({ page }) => {
    await page.goto(shareUrl);
    await expect(page.locator('#lpListDescription')).toContainText('A summer backpacking trip');
  });

  test('should display all category names', async ({ page }) => {
    await page.goto(shareUrl);
    await expect(page.locator('h2.lpCategoryName').filter({ hasText: 'Shelter' })).toBeVisible();
    await expect(page.locator('h2.lpCategoryName').filter({ hasText: 'Clothing' })).toBeVisible();
    await expect(page.locator('h2.lpCategoryName').filter({ hasText: 'Food' })).toBeVisible();
  });

  // ── Per-item data ────────────────────────────────────────────────────────

  test('should display individual item weights', async ({ page }) => {
    await page.goto(shareUrl);
    await expect(
      page.locator('li.lpItem').filter({ hasText: 'Tent' }).locator('.lpWeight'),
    ).toHaveText('32');
    await expect(
      page.locator('li.lpItem').filter({ hasText: 'Jacket' }).locator('.lpWeight'),
    ).toHaveText('16');
    await expect(
      page.locator('li.lpItem').filter({ hasText: 'Energy Bar' }).locator('.lpWeight'),
    ).toHaveText('4');
  });

  test('should display item description', async ({ page }) => {
    await page.goto(shareUrl);
    const tentItem = page.locator('li.lpItem').filter({ hasText: 'Tent' });
    await expect(tentItem.locator('.lpDescription')).toContainText('Ultralight shelter');
  });

  test('should display item URL as a link', async ({ page }) => {
    await page.goto(shareUrl);
    const tentName = page.locator('li.lpItem').filter({ hasText: 'Tent' }).locator('.lpName');
    const link = tentName.locator('a.lpHref');
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', 'https://example.com/tent');
  });

  test('should display item price', async ({ page }) => {
    await page.goto(shareUrl);
    const tentItem = page.locator('li.lpItem').filter({ hasText: 'Tent' });
    await expect(tentItem.locator('.lpPriceCell')).toContainText('150');
  });

  test('should display item quantity', async ({ page }) => {
    await page.goto(shareUrl);
    const energyBarItem = page.locator('li.lpItem').filter({ hasText: 'Energy Bar' });
    await expect(energyBarItem.locator('.lpQtyCell')).toHaveText('5');
  });

  test('should show worn indicator for worn items', async ({ page }) => {
    await page.goto(shareUrl);
    const jacketItem = page.locator('li.lpItem').filter({ hasText: 'Jacket' });
    await expect(jacketItem.locator('i.lpWorn.lpActive')).toBeVisible();
  });

  test('should show consumable indicator for consumable items', async ({ page }) => {
    await page.goto(shareUrl);
    const energyBarItem = page.locator('li.lpItem').filter({ hasText: 'Energy Bar' });
    await expect(energyBarItem.locator('i.lpConsumable.lpActive')).toBeVisible();
  });

  test('should display star rating', async ({ page }) => {
    await page.goto(shareUrl);
    const jacketItem = page.locator('li.lpItem').filter({ hasText: 'Jacket' });
    const starIcon = jacketItem.locator('i.lpStar');
    await expect(starIcon).toHaveClass(/lpStar1/);
    await expect(starIcon).not.toHaveClass(/lpHidden/);
  });

  // ── Subtotals and totals ─────────────────────────────────────────────────

  test('should display category subtotals', async ({ page }) => {
    await page.goto(shareUrl);

    const shelterCategory = page
      .locator('li.lpCategory')
      .filter({ has: page.locator('h2', { hasText: 'Shelter' }) });
    await expect(shelterCategory.locator('.lpItemsFooter .lpDisplaySubtotal')).toHaveText('32');

    const clothingCategory = page
      .locator('li.lpCategory')
      .filter({ has: page.locator('h2', { hasText: 'Clothing' }) });
    await expect(clothingCategory.locator('.lpItemsFooter .lpDisplaySubtotal')).toHaveText('16');

    const foodCategory = page
      .locator('li.lpCategory')
      .filter({ has: page.locator('h2', { hasText: 'Food' }) });
    // 5 × 4 oz = 20 oz
    await expect(foodCategory.locator('.lpItemsFooter .lpDisplaySubtotal')).toHaveText('20');
  });

  test('should display total weight and worn/consumable/base breakdowns', async ({ page }) => {
    await page.goto(shareUrl);
    await expect(page.locator('.lpTotalValue')).toHaveText('68');
    await expect(page.locator('.lpWornWeight .lpDisplaySubtotal')).toHaveText('16');
    await expect(page.locator('.lpConsumableWeight .lpDisplaySubtotal')).toHaveText('20');
    await expect(page.locator('.lpPackWeight .lpDisplaySubtotal')).toHaveText('32');
  });

  // ── Interactive: unit switching ──────────────────────────────────────────

  test('should update weight display when unit is switched', async ({ page }) => {
    await page.goto(shareUrl);

    // 32 oz = 2 lb exactly
    const tentItem = page.locator('li.lpItem').filter({ hasText: 'Tent' });
    const unitSelect = tentItem.locator('.lpUnitSelect');

    // Debug: call listReport() explicitly and check if events attach + weight updates
    const debug = await page.evaluate(() => {
      const jq = (window as any).$;
      const listReportExists = typeof (window as any).listReport === 'function';
      if (listReportExists) (window as any).listReport();
      const weightBefore = jq('li.lpItem').filter((_, el: Element) => el.textContent?.includes('Tent')).find('.lpWeight').text();
      jq('.lpList').find('.lpUnitSelect li.lb').first().trigger('click');
      const weightAfter = jq('li.lpItem').filter((_, el: Element) => el.textContent?.includes('Tent')).find('.lpWeight').text();
      return { listReportExists, weightBefore, weightAfter };
    });
    console.log('DEBUG:', JSON.stringify(debug));

    await expect(tentItem.locator('.lpWeight')).toHaveText('2');
    await expect(unitSelect.locator('span.lpDisplay')).toHaveText('lb');
  });

  // ── CSV export ───────────────────────────────────────────────────────────

  test('CSV should contain correct headers and data', async ({ page }) => {
    // Poll until CSV endpoint is ready (same timing as share view)
    await expect(async () => {
      const response = await page.request.get(csvUrl);
      expect(response.status()).toBe(200);
    }).toPass({ timeout: 30000 });

    const response = await page.request.get(csvUrl);
    const csv = await response.text();
    const lines = csv.split('\n').filter(Boolean);

    expect(lines[0]).toBe('Item Name,Category,desc,qty,weight,unit,url,price,worn,consumable');

    const tentLine = lines.find((l) => l.startsWith('Tent,'));
    expect(tentLine).toBeDefined();
    expect(tentLine).toContain('Shelter');
    expect(tentLine).toContain('Ultralight shelter');
    expect(tentLine).toContain(',32,');
    expect(tentLine).toContain('ounce');
    expect(tentLine).toContain('https://example.com/tent');
    expect(tentLine).toContain(',150,');

    const jacketLine = lines.find((l) => l.startsWith('Jacket,'));
    expect(jacketLine).toBeDefined();
    expect(jacketLine).toContain('Clothing');
    expect(jacketLine).toContain(',16,');
    expect(jacketLine).toContain('Worn');

    const energyBarLine = lines.find((l) => l.startsWith('Energy Bar,'));
    expect(energyBarLine).toBeDefined();
    expect(energyBarLine).toContain('Food');
    expect(energyBarLine).toContain(',5,');
    expect(energyBarLine).toContain(',4,');
    expect(energyBarLine).toContain('Consumable');
  });
});
