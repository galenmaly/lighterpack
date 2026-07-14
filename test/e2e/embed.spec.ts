import { test, expect } from '@playwright/test';

import { registerUser, generateTestUser } from './auth-utils';
import { createCategory, addItem } from './test-helpers';

/**
 * Tests for the embed feature (/e/:externalId).
 *
 * The embed endpoint returns a self-contained JavaScript snippet that:
 *   1. Defines listReport_{id}() — appends server-rendered HTML to #id
 *   2. Defines init_{id}() — loads jQuery + share-entry scripts, then calls listReport
 *   3. Auto-invokes init on load
 *
 * The rendered HTML is URL-encoded via JS escape() inside the script, so the
 * server response body isn't human-readable; content assertions are done by
 * actually loading the embed in a browser page.
 *
 * Test data:
 *   Tent Category  > Ultralight Tent   16 oz  qty 1
 *   Tent Category  > Sleeping Pad       8 oz  qty 1  desc "Closed-cell foam"
 *   Food Category  > Freeze Dried Meal  4 oz  qty 3
 *   ─────────────────────────────────────────────────────────────────
 *   Total 36 oz  (16 + 8 + 4×3)
 *   (Blank items auto-created per category have 0 weight, so totals are unaffected.)
 */

test.describe('Embed Feature', () => {
  let shareUrl: string;
  let embedUrl: string;
  let externalId: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    const { username, password, email } = generateTestUser('embed');
    await registerUser(page, username, password, email);
    await expect(page.getByText('Add new category', { exact: true })).toBeVisible();

    // Set list name
    const listNameInput = page.getByPlaceholder('List Name', { exact: true });
    await listNameInput.fill('Embed Test List');
    await listNameInput.blur();

    // Tent Category with two items
    const tentCategory = await createCategory(page, 'Tent Category');
    await addItem(tentCategory, 'Ultralight Tent', { weight: '16' });
    await addItem(tentCategory, 'Sleeping Pad', {
      weight: '8',
      description: 'Closed-cell foam',
    });

    // Food Category with qty > 1 to exercise subtotal math
    const foodCategory = await createCategory(page, 'Food Category');
    await addItem(foodCategory, 'Freeze Dried Meal', { weight: '4', quantity: '3' });

    // Get share URL and derive embed URL / externalId
    await page.getByText('Share', { exact: true }).hover();
    const shareUrlInput = page.getByLabel('Share your list');
    await expect(shareUrlInput).toHaveValue(/\/r\/[a-zA-Z0-9]+/, { timeout: 10000 });
    shareUrl = await shareUrlInput.inputValue();
    const match = shareUrl.match(/\/r\/([a-zA-Z0-9]+)/);
    externalId = match ? match[1] : '';
    embedUrl = shareUrl.replace('/r/', '/e/');

    // Poll until the share endpoint returns 200 — embed uses the same underlying data
    await expect(async () => {
      const response = await page.request.get(shareUrl);
      expect(response.status()).toBe(200);
    }).toPass({ timeout: 30000 });

    await page.close();
  });

  // ── Endpoint contract ─────────────────────────────────────────────────────

  test('embed endpoint should return 200', async ({ page }) => {
    const response = await page.request.get(embedUrl);
    expect(response.status()).toBe(200);
  });

  test('embed response should define listReport and init functions', async ({ page }) => {
    const response = await page.request.get(embedUrl);
    const body = await response.text();
    expect(body).toContain(`listReport_${externalId}`);
    expect(body).toContain(`init_${externalId}`);
  });

  // ── In-browser rendering ──────────────────────────────────────────────────

  /**
   * Each rendering test loads the embed script into a minimal page via setContent.
   * The script bootstraps itself: loads jQuery if absent, then the share-entry JS,
   * then calls listReport_{id}() which appends the server-rendered HTML.
   *
   * beforeEach waits for the list title to become visible, which guarantees the
   * full async init chain has completed before any assertion runs.
   */
  test.describe('in-browser rendering', () => {
    test.beforeEach(async ({ page }) => {
      await page.setContent(
        `<!DOCTYPE html>
         <html>
           <head></head>
           <body>
             <div id="${externalId}"></div>
             <script src="${embedUrl}"></script>
           </body>
         </html>`,
        { waitUntil: 'domcontentloaded' },
      );
      // externalId may start with a digit, so use attribute selector instead of #id (invalid CSS).
      // Wait for the embed's async init chain to complete (jQuery load → share-entry JS → HTML appended).
      await expect(page.locator(`[id="${externalId}"] .lpListName`)).toBeVisible({ timeout: 30000 });
    });

    test('should render the list title', async ({ page }) => {
      await expect(page.locator(`[id="${externalId}"] h2.lpListName`)).toHaveText('Embed Test List');
    });

    test('should render category names', async ({ page }) => {
      const list = page.locator(`[id="${externalId}"]`);
      await expect(
        list.locator('h2.lpCategoryName').filter({ hasText: 'Tent Category' }),
      ).toBeVisible();
      await expect(
        list.locator('h2.lpCategoryName').filter({ hasText: 'Food Category' }),
      ).toBeVisible();
    });

    test('should render item names', async ({ page }) => {
      const list = page.locator(`[id="${externalId}"]`);
      await expect(list.locator('li.lpItem').filter({ hasText: 'Ultralight Tent' })).toBeVisible();
      await expect(list.locator('li.lpItem').filter({ hasText: 'Sleeping Pad' })).toBeVisible();
      await expect(list.locator('li.lpItem').filter({ hasText: 'Freeze Dried Meal' })).toBeVisible();
    });

    test('should render item descriptions', async ({ page }) => {
      const list = page.locator(`[id="${externalId}"]`);
      const padItem = list.locator('li.lpItem').filter({ hasText: 'Sleeping Pad' });
      await expect(padItem.locator('.lpDescription')).toContainText('Closed-cell foam');
    });

    test('should render item weights', async ({ page }) => {
      const list = page.locator(`[id="${externalId}"]`);
      await expect(
        list.locator('li.lpItem').filter({ hasText: 'Ultralight Tent' }).locator('.lpWeight'),
      ).toHaveText('16');
      await expect(
        list.locator('li.lpItem').filter({ hasText: 'Sleeping Pad' }).locator('.lpWeight'),
      ).toHaveText('8');
    });

    test('should render item quantity', async ({ page }) => {
      const list = page.locator(`[id="${externalId}"]`);
      await expect(
        list.locator('li.lpItem').filter({ hasText: 'Freeze Dried Meal' }).locator('.lpQtyCell'),
      ).toHaveText('3');
    });

    test('should render total weight', async ({ page }) => {
      const list = page.locator(`[id="${externalId}"]`);
      // 16 + 8 + (4 × 3) = 36 oz  (blank items have 0 weight and don't affect total)
      await expect(list.locator('.lpTotalValue')).toHaveText('36');
    });

    test('should render category subtotals', async ({ page }) => {
      const list = page.locator(`[id="${externalId}"]`);

      const tentCat = list
        .locator('li.lpCategory')
        .filter({ has: page.locator('h2', { hasText: 'Tent Category' }) });
      // 16 + 8 = 24 oz
      await expect(tentCat.locator('.lpItemsFooter .lpDisplaySubtotal')).toHaveText('24');

      const foodCat = list
        .locator('li.lpCategory')
        .filter({ has: page.locator('h2', { hasText: 'Food Category' }) });
      // 4 × 3 = 12 oz
      await expect(foodCat.locator('.lpItemsFooter .lpDisplaySubtotal')).toHaveText('12');
    });
  });
});
