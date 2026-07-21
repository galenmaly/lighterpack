import { test, expect } from '@playwright/test';

import { registerUser, generateTestUser } from './auth-utils';
import { createCategoryWithItem, markItemAsWorn } from './test-helpers';

/**
 * Worn-quantity hint.
 *
 * Worn weight only ever counts a single unit of an item — the rest fall to pack
 * weight (see Category.calculateSubtotal). When a worn item has quantity > 1,
 * focusing its row shows a hint saying so. A checkbox in Account Settings toggles
 * the hint off, mirroring the shared-item bubble.
 */

test.describe('Worn quantity hint', () => {
  test('shows only when a focused worn item has quantity over 1', async ({ page }) => {
    const { username, password, email } = generateTestUser('wornqty');

    await registerUser(page, username, password, email);

    // Quantity 2 but not worn yet: focusing the row shows no hint.
    const { itemRow } = await createCategoryWithItem(page, 'Worn Gear', 'Trekking Poles', { quantity: '2' });
    await itemRow.getByPlaceholder('Name', { exact: true }).click();
    await expect(page.getByTestId('worn-qty-hint')).toHaveCount(0);

    // Mark worn: now quantity 2 && worn, so the hint appears naming the quantity.
    await markItemAsWorn(itemRow);
    await itemRow.getByPlaceholder('Name', { exact: true }).click();
    const hint = page.getByTestId('worn-qty-hint');
    await expect(hint).toBeVisible();
    await expect(hint).toContainText('Only 1 of 2 counts as worn');

    // Dropping back to quantity 1 hides it (worn item, but nothing surprising).
    await itemRow.getByTestId('item-qty').clear();
    await itemRow.getByTestId('item-qty').fill('1');
    await expect(page.getByTestId('worn-qty-hint')).toHaveCount(0);
  });

  test('the Account Settings toggle turns the hint off', async ({ page }) => {
    const { username, password, email } = generateTestUser('wornqtytoggle');

    await registerUser(page, username, password, email);

    const { itemRow } = await createCategoryWithItem(page, 'Worn Gear', 'Camp Shoes', { quantity: '3' });
    await markItemAsWorn(itemRow);
    await itemRow.getByPlaceholder('Name', { exact: true }).click();
    await expect(page.getByTestId('worn-qty-hint')).toBeVisible();

    // Turn the hint off in account settings.
    await page.getByTestId('account-menu').hover();
    await page.getByText('Account Settings').click();
    const toggle = page.getByTestId('worn-qty-hint-toggle');
    await expect(toggle).toBeChecked();
    await toggle.uncheck();
    await page.locator('#accountSettings').getByText('Cancel').click();

    await itemRow.getByPlaceholder('Name', { exact: true }).click();
    await expect(page.getByTestId('worn-qty-hint')).toHaveCount(0);
  });

  test('the dismiss ✕ turns the hint off for good', async ({ page }) => {
    const { username, password, email } = generateTestUser('wornqtydismiss');

    await registerUser(page, username, password, email);

    const { itemRow } = await createCategoryWithItem(page, 'Worn Gear', 'Rain Jacket', { quantity: '2' });
    await markItemAsWorn(itemRow);
    await itemRow.getByPlaceholder('Name', { exact: true }).click();
    await expect(page.getByTestId('worn-qty-hint')).toBeVisible();

    // The ✕ turns the preference off, so the hint stays gone even on refocus …
    await page.getByTestId('worn-qty-hint-dismiss').click();
    await expect(page.getByTestId('worn-qty-hint')).toHaveCount(0);
    await itemRow.getByPlaceholder('Name', { exact: true }).click();
    await expect(page.getByTestId('worn-qty-hint')).toHaveCount(0);

    // … and Account Settings shows the preference itself is now off.
    await page.getByTestId('account-menu').hover();
    await page.getByText('Account Settings').click();
    await expect(page.getByTestId('worn-qty-hint-toggle')).not.toBeChecked();
  });
});
