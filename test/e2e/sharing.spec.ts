import { test, expect } from '@playwright/test';

import { testRoot } from './utils';
import { registerUser, generateTestUser } from './auth-utils';
import { createCategory, addItem, getCategoryNames } from './test-helpers';

test.describe('List Sharing', () => {
  test.beforeEach(async ({ page }) => {
    const { username, password, email } = generateTestUser('share');

    await registerUser(page, username, password, email);
    await expect(page.getByText('Welcome to LighterPack!')).toBeVisible();

    // Set a list name
    const listNameInput = page.getByPlaceholder('List Name', { exact: true });
    await listNameInput.fill('My Gear List');
    await listNameInput.blur();

    // Create a category with items for a meaningful list
    await page.getByText('Add new category', { exact: true }).click();
    const category = page.getByTestId('category').first();
    await category.getByPlaceholder('Category Name', { exact: true }).fill('Shelter');
    await category.getByPlaceholder('Category Name', { exact: true }).blur();

    await category.getByText('Add new item', { exact: true }).click();
    const itemRow = category.getByTestId('item-row').last();
    await itemRow.getByPlaceholder('Name', { exact: true }).fill('Tent');
    await itemRow.getByTestId('item-weight').fill('32');
    await itemRow.getByTestId('item-weight').blur();
  });

  test('should generate a share URL', async ({ page }) => {
    // Hover over share to open popover (use text selector)
    await page.getByText('Share', { exact: true }).hover();

    // Wait for share URL input to appear and be populated (async fetch for externalId)
    const shareUrlInput = page.getByLabel('Share your list');
    await expect(shareUrlInput).toBeVisible();
    await expect(shareUrlInput).toHaveValue(/\/r\/[a-zA-Z0-9]+/, { timeout: 10000 });

    // Verify it has a valid URL
    const shareUrl = await shareUrlInput.inputValue();
    expect(shareUrl).toMatch(/\/r\/[a-zA-Z0-9]+/);
  });

  test('should have accessible share URL', async ({ page }) => {
    await page.getByText('Share', { exact: true }).hover();

    const shareUrlInput = page.getByLabel('Share your list');
    await expect(shareUrlInput).toHaveValue(/\S/);

    const shareUrl = await shareUrlInput.inputValue();

    // Verify the share URL is accessible
    await expect(async () => {
      const response = await page.request.get(shareUrl);
      expect(response.status()).toBe(200);
    }).toPass();
  });

  test('shared list should display correctly', async ({ page }) => {
    await page.getByText('Share', { exact: true }).hover();

    // Wait for share URL to be populated (async fetch)
    const shareUrlInput = page.getByLabel('Share your list');
    await expect(shareUrlInput).toHaveValue(/\/r\/[a-zA-Z0-9]+/, { timeout: 10000 });
    const shareUrl = await shareUrlInput.inputValue();

    // Poll until the share URL returns 200. The endpoint returns 400 until saveLibrary
    // has persisted the library with the matching externalId, so this implicitly waits
    // for the auto-save to complete (up to 30s).
    await expect(async () => {
      const response = await page.request.get(shareUrl);
      expect(response.status()).toBe(200);
    }).toPass({ timeout: 30000 });

    await page.goto(shareUrl);

    await expect(page.getByRole('heading', { level: 1 })).toContainText('My Gear List');
    await expect(page.getByRole('heading', { name: 'Shelter' })).toBeVisible();
    await expect(page.getByText('Tent')).toBeVisible();
  });

  test('should have embed code', async ({ page }) => {
    await page.getByText('Share', { exact: true }).hover();

    const shareUrlInput = page.getByLabel('Share your list');
    await expect(shareUrlInput).toHaveValue(/\/r\/[a-zA-Z0-9]+/, { timeout: 10000 });
    const shareUrl = await shareUrlInput.inputValue();
    const shareMatch = shareUrl.match(/\/r\/([a-zA-Z0-9]+)/);
    expect(shareMatch).not.toBeNull();
    const externalId = shareMatch ? shareMatch[1] : '';

    const embedTextarea = page.getByLabel('Embed your list');
    await expect(embedTextarea).toBeVisible();

    // Verify embed code contains script tag
    const embedCode = await embedTextarea.inputValue();
    expect(embedCode).toContain('<script');
    expect(embedCode).toContain(`/e/${externalId}`);
    expect(embedCode).toContain(`id="${externalId}"`);
  });
});

test.describe('CSV Export', () => {
  test.beforeEach(async ({ page }) => {
    const { username, password, email } = generateTestUser('csv');

    await registerUser(page, username, password, email);
    await expect(page.getByText('Welcome to LighterPack!')).toBeVisible();

    // Set up a list with items to export
    const listNameInput = page.getByPlaceholder('List Name', { exact: true });
    await listNameInput.fill('Export Test List');
    await listNameInput.blur();

    await page.getByText('Add new category', { exact: true }).click();
    const category = page.getByTestId('category').first();
    await category.getByPlaceholder('Category Name', { exact: true }).fill('Gear');
    await category.getByPlaceholder('Category Name', { exact: true }).blur();

    await category.getByText('Add new item', { exact: true }).click();
    const itemRow = category.getByTestId('item-row').last();
    await itemRow.getByPlaceholder('Name', { exact: true }).fill('Backpack');
    await itemRow.getByPlaceholder('Description', { exact: true }).fill('Ultralight 40L');
    await itemRow.getByTestId('item-weight').fill('24');
    await itemRow.getByTestId('item-weight').blur();
  });

  test('should have CSV export link', async ({ page }) => {
    await page.getByText('Share', { exact: true }).hover();

    const shareUrlInput = page.getByLabel('Share your list');
    await expect(shareUrlInput).toHaveValue(/\/r\/[a-zA-Z0-9]+/, { timeout: 10000 });
    const shareUrl = await shareUrlInput.inputValue();
    const shareMatch = shareUrl.match(/\/r\/([a-zA-Z0-9]+)/);
    expect(shareMatch).not.toBeNull();
    const externalId = shareMatch ? shareMatch[1] : '';

    const csvLink = page.locator('#csvUrl');
    await expect(csvLink).toBeVisible();

    const csvHref = await csvLink.getAttribute('href');
    expect(csvHref).toContain(`/csv/${externalId}`);
  });

  test('should download CSV file', async ({ page }) => {
    await page.getByText('Share', { exact: true }).hover();

    const shareUrlInput = page.getByLabel('Share your list');
    await expect(shareUrlInput).toHaveValue(/\/r\/[a-zA-Z0-9]+/, { timeout: 10000 });

    const csvLink = page.locator('#csvUrl');
    const csvUrl = await csvLink.getAttribute('href');
    expect(csvUrl).toContain('/csv/');

    // Poll until the CSV endpoint returns 200. Like the share view, it returns 400 until
    // saveLibrary has persisted the library with the matching externalId.
    await expect(async () => {
      const response = await page.request.get(csvUrl!);
      expect(response.status()).toBe(200);
    }).toPass({ timeout: 30000 });

    const response = await page.request.get(csvUrl!);
    expect(response.headers()['content-type']).toContain('text/csv');
  });
});

test.describe('CSV Import', () => {
  test.beforeEach(async ({ page }) => {
    const { username, password, email } = generateTestUser('imp');

    await registerUser(page, username, password, email);
    await expect(page.getByText('Welcome to LighterPack!')).toBeVisible();
  });

  test('should open file chooser from import CSV option', async ({ page }) => {
    // Open the add list popover to reveal the import option
    await page.getByText('Add new list', { exact: true }).first().hover();

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByText('Import CSV', { exact: true }).click(),
    ]);

    expect(fileChooser).toBeTruthy();
  });

  test('should reject non-CSV uploads', async ({ page }) => {
    const dialogPromise = page.waitForEvent('dialog').then(async (dialog) => {
      const message = dialog.message();
      await dialog.accept();
      return message;
    });
    await page.getByText('Add new list', { exact: true }).first().hover();

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByText('Import CSV', { exact: true }).click(),
    ]);

    await fileChooser.setFiles({
      name: 'not-csv.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not a csv'),
    });

    const dialogMessage = await dialogPromise;
    expect(dialogMessage).toContain('Please select a CSV.');
  });

  test('should reject CSVs with invalid content', async ({ page }) => {
    const dialogPromise = page.waitForEvent('dialog').then(async (dialog) => {
      const message = dialog.message();
      await dialog.accept();
      return message;
    });
    await page.getByText('Add new list', { exact: true }).first().hover();

    const invalidCsv = [
      'Item Name,Category,Description,Qty,Weight,Unit',
      'Bad Item,Test,Invalid unit,1,2,stone',
    ].join('\n');

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByText('Import CSV', { exact: true }).click(),
    ]);

    await fileChooser.setFiles({
      name: 'invalid.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(invalidCsv),
    });

    const dialogMessage = await dialogPromise;
    expect(dialogMessage).toContain('Unable to load spreadsheet');
  });

  test('should import a valid CSV and create categories/items', async ({ page }) => {
    await page.getByText('Add new list', { exact: true }).first().hover();

    const validCsv = [
      'Item Name,Category,Description,Qty,Weight,Unit',
      'Tent,Shelter,Two-person,1,32,oz',
      'Stove,Kitchen,Canister,2,4,oz',
    ].join('\n');

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByText('Import CSV', { exact: true }).click(),
    ]);

    await fileChooser.setFiles({
      name: 'Trip List.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(validCsv),
    });

    await expect(page.locator('#importValidate')).toBeVisible();
    await page.getByText('Import List', { exact: true }).click();

    await expect(page.getByPlaceholder('List Name', { exact: true })).toHaveValue('Trip List');

    const categoryNames = await getCategoryNames(page);
    expect(categoryNames).toContain('Shelter');
    expect(categoryNames).toContain('Kitchen');

    const itemNames = await page.getByTestId('item-row').evaluateAll((nodes) =>
      nodes.map((node) => {
        const input = node.querySelector('input.lpName');
        return input ? input.value : '';
      }),
    );
    expect(itemNames).toContain('Tent');
    expect(itemNames).toContain('Stove');
  });

  test('should import quantities and units correctly', async ({ page }) => {
    await page.getByText('Add new list', { exact: true }).first().hover();

    const validCsv = [
      'Item Name,Category,Description,Qty,Weight,Unit',
      'Water Bottle,Hydration,Filtered,2,16,oz',
      'Fuel Canister,Cooking,Isobutane,1,0.5,lb',
    ].join('\n');

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByText('Import CSV', { exact: true }).click(),
    ]);

    await fileChooser.setFiles({
      name: 'Units.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(validCsv),
    });

    await expect(page.locator('#importValidate')).toBeVisible();
    await page.getByText('Import List', { exact: true }).click();

    await expect(page.getByPlaceholder('List Name', { exact: true })).toHaveValue('Units');

    const itemRows = page.getByTestId('item-row');
    const itemNames = await itemRows.evaluateAll((nodes) =>
      nodes.map((node) => {
        const input = node.querySelector('input.lpName');
        return input ? input.value : '';
      }),
    );
    expect(itemNames).toContain('Water Bottle');
    expect(itemNames).toContain('Fuel Canister');

    const qtyValues = await itemRows.evaluateAll((nodes) =>
      nodes.map((node) => {
        const input = node.querySelector('input.lpQty');
        return input ? input.value : '';
      }),
    );
    expect(qtyValues).toContain('2');
  });
});

test.describe('Share URL Persistence', () => {
  test('share URL should remain the same after modifications', async ({ page }) => {
    const { username, password, email } = generateTestUser('persist');

    await registerUser(page, username, password, email);
    await expect(page.getByText('Welcome to LighterPack!')).toBeVisible();

    // Get initial share URL
    await page.getByText('Share', { exact: true }).hover();
    const shareUrlInput = page.getByLabel('Share your list');
    await expect(shareUrlInput).toHaveValue(/\S/);
    const initialShareUrl = await shareUrlInput.inputValue();

    // Close popover
    await page.click('body', { position: { x: 10, y: 10 } });

    // Add some content
    await page.getByText('Add new category', { exact: true }).click();
    const category = page.getByTestId('category').first();
    await category.getByPlaceholder('Category Name', { exact: true }).fill('New Category');
    await category.getByPlaceholder('Category Name', { exact: true }).blur();

    // Check share URL again
    await page.getByText('Share', { exact: true }).hover();
    const updatedShareUrl = await shareUrlInput.inputValue();

    // Share URL should be the same (external ID doesn't change)
    expect(updatedShareUrl).toBe(initialShareUrl);
  });

  test('modifications should be reflected in shared view', async ({ page }) => {
    const { username, password, email } = generateTestUser('reflect');

    await registerUser(page, username, password, email);

    const listNameInput = page.getByPlaceholder('List Name', { exact: true });
    await listNameInput.fill('Updated List');
    await listNameInput.blur();

    const category = await createCategory(page, 'Category 1');
    await addItem(category, 'Test Item', { weight: '10' });

    await page.getByText('Share', { exact: true }).hover();
    const shareUrlInput = page.getByLabel('Share your list');
    await expect(shareUrlInput).toHaveValue(/\/r\/[a-zA-Z0-9]+/, { timeout: 10000 });
    const shareUrl = await shareUrlInput.inputValue();

    // Poll until the share URL returns 200 (implicitly waits for saveLibrary)
    await expect(async () => {
      const response = await page.request.get(shareUrl);
      expect(response.status()).toBe(200);
    }).toPass({ timeout: 30000 });

    await page.goto(shareUrl);

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Updated List');
    await expect(page.getByRole('heading', { name: 'Category 1' })).toBeVisible();
    await expect(page.getByText('Test Item')).toBeVisible();
  });
});
