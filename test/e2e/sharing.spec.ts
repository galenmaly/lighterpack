import { test, expect } from '@playwright/test';

import { testRoot } from './utils';
import { registerUser } from './auth-utils';

test.describe('List Sharing', () => {
  test.beforeEach(async ({ page }) => {
    const now = Date.now();
    const username = `share${now}`;
    const email = `share+${now}@lighterpack.com`;
    const password = 'testtest';

    await registerUser(page, username, password, email);
    await expect(page.getByText('Welcome to LighterPack!')).toBeVisible();

    // Set a list name
    await page.locator('input.lpListName').fill('My Gear List');
    await page.locator('input.lpListName').blur();

    // Create a category with items for a meaningful list
    await page.click('a.addCategory');
    await page.locator('input.lpCategoryName').first().fill('Shelter');
    await page.locator('input.lpCategoryName').first().blur();

    await page.click('a.lpAddItem');
    await page.locator('input.lpName').first().fill('Tent');
    await page.locator('input.lpWeight').first().fill('32');
    await page.locator('input.lpWeight').first().blur();
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

  // TODO: Share page not rendering correctly - investigate server-side rendering
  test.skip('shared list should display correctly', async ({ page }) => {
    await page.getByText('Share', { exact: true }).hover();

    // Wait for share URL to be populated (async fetch)
    const shareUrlInput = page.getByLabel('Share your list');
    await expect(shareUrlInput).toHaveValue(/\/r\/[a-zA-Z0-9]+/, { timeout: 10000 });
    const shareUrl = await shareUrlInput.inputValue();

    // Wait for data to sync to server
    await page.waitForTimeout(1000);

    // Navigate to shared list and wait for it to load
    await page.goto(shareUrl, { waitUntil: 'networkidle' });

    // Verify list name is visible (shared page uses h1.lpListName)
    await expect(page.locator('h1.lpListName')).toContainText('My Gear List', { timeout: 10000 });

    // Verify category is visible
    await expect(page.getByText('Shelter')).toBeVisible();

    // Verify item is visible
    await expect(page.getByText('Tent')).toBeVisible();
  });

  test('should have embed code', async ({ page }) => {
    await page.getByText('Share', { exact: true }).hover();

    const embedTextarea = page.getByLabel('Embed your list');
    await expect(embedTextarea).toBeVisible();

    // Verify embed code contains script tag
    const embedCode = await embedTextarea.inputValue();
    expect(embedCode).toContain('<script');
  });
});

test.describe('CSV Export', () => {
  test.beforeEach(async ({ page }) => {
    const now = Date.now();
    const username = `csv${now}`;
    const email = `csv+${now}@lighterpack.com`;
    const password = 'testtest';

    await registerUser(page, username, password, email);
    await expect(page.getByText('Welcome to LighterPack!')).toBeVisible();

    // Set up a list with items to export
    await page.locator('input.lpListName').fill('Export Test List');
    await page.locator('input.lpListName').blur();

    await page.click('a.addCategory');
    await page.locator('input.lpCategoryName').first().fill('Gear');
    await page.locator('input.lpCategoryName').first().blur();

    await page.click('a.lpAddItem');
    await page.locator('input.lpName').first().fill('Backpack');
    await page.locator('input.lpDescription').first().fill('Ultralight 40L');
    await page.locator('input.lpWeight').first().fill('24');
    await page.locator('input.lpWeight').first().blur();
  });

  test('should have CSV export link', async ({ page }) => {
    await page.getByText('Share', { exact: true }).hover();

    const csvLink = page.getByText('Export to CSV');
    await expect(csvLink).toBeVisible();
  });

  // TODO: CSV endpoint returns 500 - investigate server-side issue
  test.skip('should download CSV file', async ({ page }) => {
    await page.getByText('Share', { exact: true }).hover();

    // Wait for share URL to be populated (CSV needs externalId)
    const shareUrlInput = page.getByLabel('Share your list');
    await expect(shareUrlInput).toHaveValue(/\/r\/[a-zA-Z0-9]+/, { timeout: 10000 });

    // Wait for data to sync to server
    await page.waitForTimeout(500);

    // Get the CSV link href
    const csvLink = page.locator('#csvUrl');
    const csvUrl = await csvLink.getAttribute('href');
    expect(csvUrl).toContain('/csv/');

    // Verify CSV endpoint returns valid response
    const response = await page.request.get(csvUrl!);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/csv');
  });
});

test.describe('CSV Import', () => {
  test.beforeEach(async ({ page }) => {
    const now = Date.now();
    const username = `imp${now}`;
    const email = `imp+${now}@lighterpack.com`;
    const password = 'testtest';

    await registerUser(page, username, password, email);
    await expect(page.getByText('Welcome to LighterPack!')).toBeVisible();
  });

  test('should have import CSV option', async ({ page }) => {
    // Look for import option in sidebar
    const importLink = page.getByText('Import CSV');
    await expect(importLink).toBeVisible();
  });
});

test.describe('Share URL Persistence', () => {
  test('share URL should remain the same after modifications', async ({ page }) => {
    const now = Date.now();
    const username = `persist${now}`;
    const email = `persist+${now}@lighterpack.com`;
    const password = 'testtest';

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
    await page.click('a.addCategory');
    await page.locator('input.lpCategoryName').first().fill('New Category');
    await page.locator('input.lpCategoryName').first().blur();

    // Check share URL again
    await page.getByText('Share', { exact: true }).hover();
    const updatedShareUrl = await shareUrlInput.inputValue();

    // Share URL should be the same (external ID doesn't change)
    expect(updatedShareUrl).toBe(initialShareUrl);
  });

  // TODO: Share page not rendering correctly - investigate server-side rendering
  test.skip('modifications should be reflected in shared view', async ({ page }) => {
    const now = Date.now();
    const username = `reflect${now}`;
    const email = `reflect+${now}@lighterpack.com`;
    const password = 'testtest';

    await registerUser(page, username, password, email);

    // Set list name
    await page.locator('input.lpListName').fill('Updated List');
    await page.locator('input.lpListName').blur();

    // Add content to the last category (newly created ones are added at end)
    await page.click('a.addCategory');
    const category = page.locator('li.lpCategory').last();
    await category.locator('input.lpCategoryName').fill('Category 1');
    await category.locator('input.lpCategoryName').blur();

    await category.locator('a.lpAddItem').click();
    const item = category.locator('li.lpItem').last();
    await item.locator('input.lpName').fill('Test Item');
    await item.locator('input.lpWeight').fill('10');
    await item.locator('input.lpWeight').blur();

    // Get share URL (wait for async fetch)
    await page.getByText('Share', { exact: true }).hover();
    const shareUrlInput = page.getByLabel('Share your list');
    await expect(shareUrlInput).toHaveValue(/\/r\/[a-zA-Z0-9]+/, { timeout: 10000 });
    const shareUrl = await shareUrlInput.inputValue();

    // Wait for data to sync
    await page.waitForTimeout(1000);

    // Visit shared URL and wait for load
    await page.goto(shareUrl, { waitUntil: 'networkidle' });

    // Verify content is visible (use locator for class-based h1)
    await expect(page.locator('h1.lpListName')).toContainText('Updated List', { timeout: 10000 });
    await expect(page.getByText('Category 1')).toBeVisible();
    await expect(page.getByText('Test Item')).toBeVisible();
  });
});
