import { test, expect } from '@playwright/test';

import { registerUser, generateTestUser } from './auth-utils';
import { openSidebar, createCategoryWithItem } from './test-helpers';

/**
 * Shared-item bubble + "Edit a copy instead" (forkItem).
 *
 * Items are shared across lists by reference (copying a list reuses the same
 * item records). Focusing a row whose item appears in 2+ lists shows a bubble
 * naming the other lists; "Edit a copy instead" detaches this list's entry
 * into an independent copy.
 */

test.describe('Shared item bubble', () => {
  test('no bubble for an item that is only in one list', async ({ page }) => {
    const { username, password, email } = generateTestUser('forknone');

    await registerUser(page, username, password, email);

    const { itemRow } = await createCategoryWithItem(page, 'Shelter', 'Lonely Tent');

    await itemRow.getByPlaceholder('Name', { exact: true }).click();
    await expect(page.getByTestId('shared-item-bubble')).toHaveCount(0);
  });

  test('focusing a shared item shows the bubble; Edit a copy detaches it', async ({ page }) => {
    const { username, password, email } = generateTestUser('fork');

    await registerUser(page, username, password, email);
    await openSidebar(page);

    const listNameInput = page.getByPlaceholder('Name your list', { exact: true });
    await listNameInput.fill('Original List');
    await listNameInput.blur();

    await createCategoryWithItem(page, 'Shelter', 'Shared Tent');

    // Copying a list shares the underlying item records.
    await page.getByTestId('new-list').hover();
    await page.getByText('Copy a list', { exact: true }).click();
    const listToCopy = page.locator('#listToCopy');
    await expect(listToCopy).toBeVisible();
    await listToCopy.selectOption({ label: 'Original List' });
    await page.locator('#copyConfirm').click();
    await expect(listNameInput).toHaveValue('Copy of Original List');

    // Focusing the shared item's row shows the bubble naming the other list.
    // (Scope to the last category — the default list ships with a blank one.)
    const itemRow = page.getByTestId('category').last().getByTestId('item-row').nth(1);
    await itemRow.getByPlaceholder('Name', { exact: true }).click();
    const bubble = page.getByTestId('shared-item-bubble');
    await expect(bubble).toBeVisible();
    await expect(bubble).toContainText('Also in');
    await expect(bubble).toContainText('Original List');

    // Blurring the row hides the bubble again.
    await listNameInput.click();
    await expect(bubble).toHaveCount(0);

    // Edit a copy: the bubble disappears (item is no longer shared) …
    await itemRow.getByPlaceholder('Name', { exact: true }).click();
    await expect(bubble).toBeVisible();
    await page.getByTestId('fork-item').click();
    await expect(page.getByTestId('shared-item-bubble')).toHaveCount(0);

    // … and edits stay local to this list.
    const forkedRow = page.getByTestId('category').last().getByTestId('item-row').nth(1);
    await forkedRow.getByPlaceholder('Name', { exact: true }).fill('Forked Tent');
    await forkedRow.getByPlaceholder('Name', { exact: true }).blur();

    await page.locator('#lists').getByText('Original List', { exact: true }).click();
    const originalRow = page.getByTestId('category').last().getByTestId('item-row').nth(1);
    await expect(originalRow.getByPlaceholder('Name', { exact: true })).toHaveValue('Shared Tent');

    // The original item is no longer shared either: no bubble on focus.
    await originalRow.getByPlaceholder('Name', { exact: true }).click();
    await expect(page.getByTestId('shared-item-bubble')).toHaveCount(0);
  });

  test('switching lists does not refocus previously added rows', async ({ page }) => {
    const { username, password, email } = generateTestUser('refocus');

    await registerUser(page, username, password, email);
    await openSidebar(page);

    const listNameInput = page.getByPlaceholder('Name your list', { exact: true });
    await listNameInput.fill('Focus A');
    await listNameInput.blur();

    // Adding a category + item marks them _isNew (focus-on-create).
    await createCategoryWithItem(page, 'Gear', 'Widget');

    await page.getByTestId('new-list').click();
    await listNameInput.fill('Focus B');
    await listNameInput.blur();

    // Switching back must not restore focus to the last-added row.
    await page.locator('#lists').getByText('Focus A', { exact: true }).click();
    await expect(page.getByTestId('category').last().getByTestId('item-row').nth(1).getByPlaceholder('Name', { exact: true })).toHaveValue('Widget');
    const focusInRow = await page.evaluate(() => Boolean(document.activeElement && document.activeElement.closest('.lpItem, .lpItemsHeader')));
    expect(focusInRow).toBe(false);
  });

  test('editing a shared item without forking updates every list', async ({ page }) => {
    const { username, password, email } = generateTestUser('forkshare');

    await registerUser(page, username, password, email);
    await openSidebar(page);

    const listNameInput = page.getByPlaceholder('Name your list', { exact: true });
    await listNameInput.fill('List A');
    await listNameInput.blur();

    await createCategoryWithItem(page, 'Cooking', 'Stove');

    await page.getByTestId('new-list').hover();
    await page.getByText('Copy a list', { exact: true }).click();
    const listToCopy = page.locator('#listToCopy');
    await expect(listToCopy).toBeVisible();
    await listToCopy.selectOption({ label: 'List A' });
    await page.locator('#copyConfirm').click();
    await expect(listNameInput).toHaveValue('Copy of List A');

    const itemRow = page.getByTestId('category').last().getByTestId('item-row').nth(1);
    await itemRow.getByPlaceholder('Name', { exact: true }).fill('Stove XL');
    await itemRow.getByPlaceholder('Name', { exact: true }).blur();

    await page.locator('#lists').getByText('List A', { exact: true }).click();
    const originalRow = page.getByTestId('category').last().getByTestId('item-row').nth(1);
    await expect(originalRow.getByPlaceholder('Name', { exact: true })).toHaveValue('Stove XL');
  });

  test('the bubble dismiss ✕ turns the shared-item warning off for good', async ({ page }) => {
    const { username, password, email } = generateTestUser('sharedismiss');

    await registerUser(page, username, password, email);
    await openSidebar(page);

    const listNameInput = page.getByPlaceholder('Name your list', { exact: true });
    await listNameInput.fill('Base List');
    await listNameInput.blur();

    await createCategoryWithItem(page, 'Shelter', 'Shared Tarp');

    await page.getByTestId('new-list').hover();
    await page.getByText('Copy a list', { exact: true }).click();
    const listToCopy = page.locator('#listToCopy');
    await expect(listToCopy).toBeVisible();
    await listToCopy.selectOption({ label: 'Base List' });
    await page.locator('#copyConfirm').click();
    await expect(listNameInput).toHaveValue('Copy of Base List');

    const itemRow = page.getByTestId('category').last().getByTestId('item-row').nth(1);
    await itemRow.getByPlaceholder('Name', { exact: true }).click();
    await expect(page.getByTestId('shared-item-bubble')).toBeVisible();

    // The ✕ turns the preference off, so the bubble stays gone even on refocus …
    await page.getByTestId('shared-item-bubble-dismiss').click();
    await expect(page.getByTestId('shared-item-bubble')).toHaveCount(0);
    await itemRow.getByPlaceholder('Name', { exact: true }).click();
    await expect(page.getByTestId('shared-item-bubble')).toHaveCount(0);

    // … and Account Settings shows the preference itself is now off.
    await page.getByTestId('account-menu').hover();
    await page.getByText('Account Settings').click();
    await expect(page.getByTestId('shared-item-bubble-toggle')).not.toBeChecked();
  });
});
