import { test, expect } from '@playwright/test';

import { registerUser, generateTestUser } from './auth-utils';

const createCategoryAndItem = async (page, categoryName, itemName) => {
  await page.getByText('Add new category', { exact: true }).click();
  const category = page.getByTestId('category').last();
  await category.getByPlaceholder('Category Name', { exact: true }).fill(categoryName);
  await category.getByPlaceholder('Category Name', { exact: true }).blur();

  await category.getByText('Add new item', { exact: true }).click();
  const itemRow = category.getByTestId('item-row').last();
  await itemRow.getByPlaceholder('Name', { exact: true }).fill(itemName);
  await itemRow.getByPlaceholder('Name', { exact: true }).blur();
  return itemRow;
};

const enableItemImages = async (page) => {
  const settings = page.locator('#settings');
  await settings.hover();
  await settings.getByLabel('Item images', { exact: true }).check();
};

test.describe('Item Media', () => {
  test('should add a link to an item', async ({ page }) => {
    const { username, password, email } = generateTestUser('link');

    await registerUser(page, username, password, email);

    const itemRow = await createCategoryAndItem(page, 'Gear', 'Link Item');
    await itemRow.hover();

    const linkIcon = itemRow.getByTitle('Add a link for this item');
    await linkIcon.click();

    const modal = page.locator('#itemLinkDialog');
    await expect(modal).toBeVisible();

    await modal.getByPlaceholder('Item Link', { exact: true }).fill('https://example.com/gear');
    await modal.locator('input[type="submit"]').click();

    await expect(modal).toBeHidden();
    await itemRow.hover();
    await expect(linkIcon).toHaveClass(/lpActive/);
  });

  test('should add an image URL and open the image viewer', async ({ page }) => {
    const { username, password, email } = generateTestUser('image');

    await registerUser(page, username, password, email);
    await enableItemImages(page);

    const itemRow = await createCategoryAndItem(page, 'Photography', 'Camera');
    await itemRow.hover();

    const imageIcon = itemRow.getByTitle('Upload a photo or use a photo from the web');
    await imageIcon.click();

    const modal = page.locator('#itemImageDialog');
    await expect(modal).toBeVisible();

    await modal.locator('#itemImageUrl').fill('https://example.com/camera.jpg');
    await modal.locator('input[type="submit"]').click();

    await expect(modal).toBeHidden();

    const thumbnail = itemRow.locator('img.lpItemImage');
    await expect(thumbnail).toBeVisible();
    await expect(thumbnail).toHaveAttribute('src', 'https://example.com/camera.jpg');

    await thumbnail.click();
    await expect(page.locator('#lpImageDialog')).toBeVisible();
  });

  test('should remove an item image URL', async ({ page }) => {
    const { username, password, email } = generateTestUser('imageremove');

    await registerUser(page, username, password, email);
    await enableItemImages(page);

    const itemRow = await createCategoryAndItem(page, 'Media', 'Photo');
    await itemRow.hover();

    const imageIcon = itemRow.getByTitle('Upload a photo or use a photo from the web');
    await imageIcon.click();

    const modal = page.locator('#itemImageDialog');
    await expect(modal).toBeVisible();

    await modal.locator('#itemImageUrl').fill('https://example.com/photo.jpg');
    await modal.locator('input[type="submit"]').click();
    await expect(modal).toBeHidden();

    await expect(itemRow.locator('img.lpItemImage')).toBeVisible();

    // Re-open the modal to remove the image URL
    await itemRow.hover();
    await imageIcon.click();
    await expect(modal).toBeVisible();

    // For URL-based images, clear the URL field and save to remove
    await modal.locator('#itemImageUrl').clear();
    await modal.locator('input[type="submit"]').click();
    await expect(modal).toBeHidden();

    await expect(itemRow.locator('img.lpItemImage')).toHaveCount(0);
  });

  test('should open file chooser for image upload', async ({ page }) => {
    const { username, password, email } = generateTestUser('imageupload');

    await registerUser(page, username, password, email);
    await enableItemImages(page);

    const itemRow = await createCategoryAndItem(page, 'Gear', 'Uploaded Photo Item');
    await itemRow.hover();

    const imageIcon = itemRow.getByTitle('Upload a photo or use a photo from the web');
    await imageIcon.click();

    const modal = page.locator('#itemImageDialog');
    await expect(modal).toBeVisible();

    // The file input is in a form outside the modal (id="image")
    const fileInput = page.locator('#image');
    await expect(fileInput).toBeAttached();

    // Verify clicking "Upload Image" button triggers file chooser
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      modal.getByRole('button', { name: 'Upload Image' }).click(),
    ]);

    expect(fileChooser).toBeTruthy();

    // Note: Actual upload requires imgur integration which may not be available in test environment
    // Cancel the file chooser by not setting any files
  });
});
