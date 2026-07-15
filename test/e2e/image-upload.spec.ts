import { test, expect } from '@playwright/test';

import { registerUser, generateTestUser } from './auth-utils';
import { createCategory, addItem } from './test-helpers';

// Requires cwebp on the machine running the server (apt install webp).

test.describe('Image upload', () => {
  test('uploads an image, shows the hosted thumbnail, and renders it on the share page', async ({ page }) => {
    const { username, password, email } = generateTestUser('imgupload');
    await registerUser(page, username, password, email);
    await expect(page.getByText('Add new category', { exact: true })).toBeVisible();

    const category = await createCategory(page, 'Photo Gear');
    const row = await addItem(category, 'Camera', { weight: '12' });

    await row.hover();
    await row.getByTitle('Upload a photo or use a photo from the web').click();

    // A valid 8x8 png (verified against cwebp), small enough to skip resizing.
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAD0lEQVR4nGM4gwMwDC0JAMg9mQEkEhIxAAAAAElFTkSuQmCC',
      'base64',
    );
    await page.locator('#image').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: png });

    const thumb = row.locator('img.lpItemImage');
    await expect(thumb).toBeVisible();
    await expect(thumb).toHaveAttribute('src', /\/userimages\/[0-9a-f]{2}\/[0-9a-f]{16}_t\.webp/);

    // The hosted files are really served.
    const thumbSrc = new URL((await thumb.getAttribute('src'))!, page.url()).toString();
    expect((await page.request.get(thumbSrc)).status()).toBe(200);
    expect((await page.request.get(thumbSrc.replace('_t.webp', '.webp'))).status()).toBe(200);

    // And the mustache-rendered share page shows the same thumbnail.
    await page.getByText('Share', { exact: true }).hover();
    const shareUrlInput = page.getByLabel('Share your list');
    await expect(shareUrlInput).toHaveValue(/\/r\/[a-zA-Z0-9]+/, { timeout: 10000 });
    const shareUrl = await shareUrlInput.inputValue();
    await expect(async () => {
      const response = await page.request.get(shareUrl);
      expect(response.status()).toBe(200);
    }).toPass({ timeout: 30000 });

    await page.goto(shareUrl);
    const shareImg = page.locator('img.lpItemImage');
    await expect(shareImg).toBeVisible();
    await expect(shareImg).toHaveAttribute('src', /\/userimages\/[0-9a-f]{2}\/[0-9a-f]{16}_t\.webp/);
    await expect(shareImg).toHaveAttribute('href', /\/userimages\/[0-9a-f]{2}\/[0-9a-f]{16}\.webp/);
  });

  test('rejects a file that is not an image', async ({ page }) => {
    const { username, password, email } = generateTestUser('imgupload');
    await registerUser(page, username, password, email);
    await expect(page.getByText('Add new category', { exact: true })).toBeVisible();

    const category = await createCategory(page, 'Photo Gear');
    const row = await addItem(category, 'Camera', { weight: '12' });

    await row.hover();
    await row.getByTitle('Upload a photo or use a photo from the web').click();

    // Claims to be a png (passes the client type check) but isn't one.
    const dialogPromise = page.waitForEvent('dialog');
    await page.locator('#image').setInputFiles({
      name: 'fake.png',
      mimeType: 'image/png',
      buffer: Buffer.from('<script>alert(1)</script> definitely not a png'),
    });
    const dialog = await dialogPromise;
    expect(dialog.message()).toContain('Upload failed');
    await dialog.accept();

    await expect(row.locator('img.lpItemImage')).not.toBeVisible();
  });
});
