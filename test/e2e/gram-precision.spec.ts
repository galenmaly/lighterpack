import { test, expect } from '@playwright/test';

import { registerUser, generateTestUser } from './auth-utils';
import { createCategory, addItem } from './test-helpers';

/**
 * Grams are the one unit fine enough that two decimals is noise: a 1.2 oz item
 * read in grams used to say 34.02, digits the author never entered. Display
 * precision now scales with magnitude — whole grams at 100 g and up, one
 * decimal from 1 g, two below that — so converted values shed the invented
 * digits while a weight genuinely typed in grams survives.
 *
 * Three separate code paths render these numbers and all three have to agree,
 * or a reader sees the digits change under them:
 *   - server render        server/views.js            (share page on load)
 *   - client unit switch   client/share-entry.js      (share page pickers)
 *   - the Vue app          client/mixins/utils-mixin.js (editor totals)
 *
 * Test data — list total unit set to g, items left in their author units:
 *   Shelter  Tent   32 oz    = 907184.0 mg  -> 907    (was 907.18)
 *   Kitchen  Stove   1.2 oz  =  34019.4 mg  ->  34    (was 34.02)
 *   Stakes   Stake  12.5 g   =  12500.0 mg  ->  12.5  (typed in g, kept)
 *            Peg     0.4 g   =    400.0 mg  ->   0.4  (sub-gram, kept)
 *   ─────────────────────────────────────────────────────────────────────
 *   Stakes subtotal 12900.0 mg -> 12.9   Total 954103.4 mg -> 954 (was 954.1)
 */

const WHOLE_954 = /^\s*954\s*$/;
const WHOLE_907 = /^\s*907\s*$/;
const WHOLE_34 = /^\s*34\s*$/;
const TENTH_12_9 = /^\s*12\.9\s*$/;

test.describe('Gram display precision', () => {
  let shareUrl: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    const { username, password, email } = generateTestUser('gramprec');
    await registerUser(page, username, password, email);
    await expect(page.getByText('Add new category', { exact: true })).toBeVisible();

    const listNameInput = page.getByPlaceholder('Name your list', { exact: true });
    await listNameInput.fill('Gram Precision');
    await listNameInput.blur();

    const shelter = await createCategory(page, 'Shelter');
    await addItem(shelter, 'Tent', { weight: '32' });

    const kitchen = await createCategory(page, 'Kitchen');
    await addItem(kitchen, 'Stove', { weight: '1.2' });

    const stakes = await createCategory(page, 'Stakes');
    await addItem(stakes, 'Stake', { weight: '12.5', unit: 'g' });
    await addItem(stakes, 'Peg', { weight: '0.4', unit: 'g' });

    // Totals in grams — the item rows stay in the units they were typed in.
    // This assertion is the Vue app's own coverage: the editor's total row is
    // the utils-mixin path, and 954.1 here would fail the whole file.
    const totalUnitSelect = page.locator('.lpTotalUnit').getByTestId('unit-select');
    await totalUnitSelect.click();
    await page.locator('ul.lpUnitDropdown li.g').first().click();
    await expect(page.getByTestId('total-weight')).toHaveText(WHOLE_954);

    await page.getByText('Share', { exact: true }).hover();
    const shareUrlInput = page.getByLabel('Share your list');
    await expect(shareUrlInput).toHaveValue(/\/r\/[a-zA-Z0-9]+/, { timeout: 10000 });
    shareUrl = await shareUrlInput.inputValue();

    // The share page is rendered from the saved copy, so wait for the write to
    // land rather than racing it.
    await expect(async () => {
      const response = await page.request.get(shareUrl);
      expect(response.status()).toBe(200);
      expect(await response.text()).toContain('Gram Precision');
    }).toPass({ timeout: 30000 });

    await page.close();
  });

  // ── Server render: the share page as it arrives ──────────────────────────

  test('server-rendered totals are whole grams', async ({ page }) => {
    await page.goto(shareUrl);

    await expect(page.locator('.lpTotalValue')).toHaveText(WHOLE_954);
    await expect(page.locator('.lpTotal .lpTotalUnit')).toContainText('g');
  });

  test('server-rendered category subtotals keep only the digits that are real', async ({ page }) => {
    await page.goto(shareUrl);

    const row = (name: string) => page
      .locator('li.lpCategory')
      .filter({ has: page.locator('h2', { hasText: name }) })
      .locator('.lpItemsHeader .lpDisplaySubtotal');

    await expect(row('Shelter')).toHaveText(WHOLE_907);
    await expect(row('Kitchen')).toHaveText(WHOLE_34);
    // Under 100 g the tenth is a digit the author actually typed, so it stays.
    await expect(row('Stakes')).toHaveText(TENTH_12_9);
  });

  // ── Client unit switch: the pickers on the share page ────────────────────

  test('switching item weights to grams matches what the server would render', async ({ page }) => {
    await page.goto(shareUrl);

    const item = (name: string) => page
      .locator('li.lpItem')
      .filter({ hasText: name })
      .locator('.lpWeight');

    // One picker switches every item row — the handler updates them together.
    const unitSelect = page
      .locator('li.lpItem')
      .filter({ hasText: 'Tent' })
      .locator('.lpUnitSelect');
    await unitSelect.click();
    await expect(unitSelect).toHaveClass(/lpOpen/);
    await unitSelect.locator('li.g').click();

    await expect(item('Tent')).toHaveText(WHOLE_907);
    await expect(item('Stove')).toHaveText(WHOLE_34);
    // Typed in grams to begin with; a conversion it never went through must
    // not round it away.
    await expect(item('Stake')).toHaveText(/^\s*12\.5\s*$/);
    await expect(item('Peg')).toHaveText(/^\s*0\.4\s*$/);
  });

  test('switching the total unit back to grams re-renders the same digits', async ({ page }) => {
    await page.goto(shareUrl);

    const totalSelect = page.locator('.lpTotalUnit .lpUnitSelect');

    // Away and back, so the grams the reader lands on come from the client
    // path rather than the server's markup.
    await totalSelect.click();
    await totalSelect.locator('li.kg').click();
    await expect(page.locator('.lpTotalValue')).toHaveText(/^\s*0\.95\s*$/);

    await totalSelect.click();
    await totalSelect.locator('li.g').click();

    await expect(page.locator('.lpTotalValue')).toHaveText(WHOLE_954);

    const row = (name: string) => page
      .locator('li.lpCategory')
      .filter({ has: page.locator('h2', { hasText: name }) })
      .locator('.lpItemsHeader .lpDisplaySubtotal');

    await expect(row('Shelter')).toHaveText(WHOLE_907);
    await expect(row('Kitchen')).toHaveText(WHOLE_34);
    await expect(row('Stakes')).toHaveText(TENTH_12_9);
  });
});
