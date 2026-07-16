import { expect, Page, Locator } from '@playwright/test';

/**
 * Opens the sidebar if it's not already open.
 */
export const openSidebar = async (page: Page): Promise<void> => {
  const main = page.locator('#main');
  await expect(main).toBeVisible();
  const currentClass = (await main.getAttribute('class')) || '';
  if (!currentClass.includes('lpHasSidebar')) {
    await page.getByTestId('toggle-sidebar').click();
    await expect(main).toHaveClass(/lpHasSidebar/);
  }
};

/**
 * Closes the sidebar if it's open.
 */
export const closeSidebar = async (page: Page): Promise<void> => {
  const main = page.locator('#main');
  await expect(main).toBeVisible();
  const currentClass = (await main.getAttribute('class')) || '';
  if (currentClass.includes('lpHasSidebar')) {
    await page.getByTestId('toggle-sidebar').click();
    await expect(main).not.toHaveClass(/lpHasSidebar/);
  }
};

/**
 * Drags an element by its handle to a target position.
 * @param page - Playwright page
 * @param handle - The drag handle element
 * @param target - The target element to drag to
 * @param reveal - Optional element to hover over to reveal the handle
 * @param targetPosition - Where to drop relative to target: 'top', 'middle', or 'bottom'
 */
export const dragHandleToTarget = async (
  page: Page,
  handle: Locator,
  target: Locator,
  reveal?: Locator,
  targetPosition: 'top' | 'middle' | 'bottom' = 'top',
): Promise<void> => {
  if (reveal) {
    await reveal.hover();
  }
  await handle.scrollIntoViewIfNeeded();
  await target.scrollIntoViewIfNeeded();
  await expect(handle).toBeVisible();
  await expect(target).toBeVisible();

  const handleBox = await handle.boundingBox();
  const targetBox = await target.boundingBox();

  if (!handleBox || !targetBox) {
    throw new Error('Unable to determine drag handles for drag and drop.');
  }

  const startX = handleBox.x + handleBox.width / 2;
  const startY = handleBox.y + handleBox.height / 2;
  let targetOffsetY = 5;
  if (targetPosition === 'bottom') {
    targetOffsetY = targetBox.height - 5;
  } else if (targetPosition === 'middle') {
    targetOffsetY = targetBox.height / 2;
  }
  const endX = targetBox.x + targetBox.width / 2;
  const endY = targetBox.y + targetOffsetY;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX, startY + 25, { steps: 8 });
  await page.waitForTimeout(120);
  await page.mouse.move(endX, endY, { steps: 20 });
  await page.waitForTimeout(80);
  await page.mouse.move(endX + 10, endY + 10, { steps: 6 });
  await page.waitForTimeout(80);
  await page.mouse.move(endX, endY, { steps: 6 });
  await page.waitForTimeout(80);
  await page.mouse.up();
};

/**
 * Simple drag from source to target by hovering over the source and dragging its handle.
 */
export const dragListItem = async (
  page: Page,
  sourceItem: Locator,
  targetItem: Locator,
): Promise<void> => {
  await sourceItem.hover();
  const handle = sourceItem.getByTitle('Reorder this list');
  const handleBox = await handle.boundingBox();
  const targetBox = await targetItem.boundingBox();
  if (!handleBox || !targetBox) {
    throw new Error('Unable to determine drag handles for list reorder.');
  }

  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2);
  await page.mouse.up();
};

/**
 * Gets all category names from the page.
 */
export const getCategoryNames = async (page: Page): Promise<string[]> => {
  return page.getByTestId('category').evaluateAll((nodes) =>
    nodes.map((node) => {
      const input = node.querySelector('input.lpCategoryName') as HTMLInputElement | null;
      return input ? input.value : '';
    }),
  );
};

/**
 * Gets all item names from a category.
 */
export const getItemNames = async (category: Locator): Promise<string[]> => {
  return category.getByTestId('item-row').evaluateAll((nodes) =>
    nodes.map((node) => {
      const input = node.querySelector('input.lpName') as HTMLInputElement | null;
      return input ? input.value : '';
    }),
  );
};

/**
 * Creates a new category with the given name.
 * @returns The category locator
 */
export const createCategory = async (page: Page, categoryName: string): Promise<Locator> => {
  await page.getByText('Add new category', { exact: true }).click();
  const category = page.getByTestId('category').last();
  await category.getByPlaceholder('Category Name', { exact: true }).fill(categoryName);
  await category.getByPlaceholder('Category Name', { exact: true }).blur();
  return category;
};

/**
 * Adds a new item to a category.
 * @returns The item row locator
 */
export const addItem = async (
  category: Locator,
  name: string,
  options?: {
    description?: string;
    weight?: string;
    unit?: 'oz' | 'lb' | 'g' | 'kg';
    quantity?: string;
    price?: string;
  },
): Promise<Locator> => {
  // Capture item count before adding to get a stable index
  const itemCountBefore = await category.getByTestId('item-row').count();

  await category.getByText('Add new item', { exact: true }).click();
  const itemRow = category.getByTestId('item-row').last();
  await itemRow.getByPlaceholder('Name', { exact: true }).fill(name);

  if (options?.description) {
    await itemRow.getByPlaceholder('Description', { exact: true }).fill(options.description);
  }

  // Set unit before weight (order matters for some interactions)
  if (options?.unit) {
    const unitSelect = itemRow.getByTestId('unit-select');
    await unitSelect.click();
    // Wait for dropdown to become visible (requires .lpOpen class)
    const dropdown = itemRow.locator('ul.lpUnitDropdown');
    await expect(dropdown).toBeVisible();
    await dropdown.locator(`li.${options.unit}`).click();
    // Wait for dropdown to close and unit to be reflected
    await expect(unitSelect.locator('span.lpDisplay')).toHaveText(options.unit);
  }

  if (options?.weight) {
    await itemRow.getByTestId('item-weight').fill(options.weight);
  }

  if (options?.quantity) {
    await itemRow.getByTestId('item-qty').clear();
    await itemRow.getByTestId('item-qty').fill(options.quantity);
  }

  if (options?.price) {
    await itemRow.getByTestId('item-price').fill(options.price);
  }

  await itemRow.getByPlaceholder('Name', { exact: true }).blur();

  // Return a stable nth() locator based on the index when the item was added
  return category.getByTestId('item-row').nth(itemCountBefore);
};

/**
 * Creates a category with a single item.
 * Waits for page to be ready before interacting.
 * @returns Object containing category and itemRow locators
 */
export const createCategoryWithItem = async (
  page: Page,
  categoryName: string,
  itemName: string,
  options?: {
    weight?: string;
    unit?: 'oz' | 'lb' | 'g' | 'kg';
    quantity?: string;
    price?: string;
  },
): Promise<{ category: Locator; itemRow: Locator }> => {
  // Wait for page to be ready
  await expect(page.getByText('Add new category', { exact: true })).toBeVisible({ timeout: 10000 });

  const category = await createCategory(page, categoryName);
  const itemRow = await addItem(category, itemName, options);

  return { category, itemRow };
};

/**
 * Enables a setting by checking its checkbox.
 */
export const enableSetting = async (page: Page, settingLabel: string): Promise<void> => {
  const settings = page.locator('#settings');
  await settings.hover();
  await settings.getByLabel(settingLabel, { exact: true }).check();
};

/**
 * Disables a setting by unchecking its checkbox.
 */
export const disableSetting = async (page: Page, settingLabel: string): Promise<void> => {
  const settings = page.locator('#settings');
  await settings.hover();
  await settings.getByLabel(settingLabel, { exact: true }).uncheck();
};

/**
 * Marks an item as worn.
 */
export const markItemAsWorn = async (itemRow: Locator): Promise<void> => {
  await itemRow.hover();
  await itemRow.getByTitle('Mark this item as worn').click();
};

/**
 * Marks an item as consumable.
 */
export const markItemAsConsumable = async (itemRow: Locator): Promise<void> => {
  await itemRow.hover();
  await itemRow.getByTitle('Mark this item as a consumable').click();
};

/**
 * Sets the star rating for an item (0-3).
 */
export const setItemStarRating = async (itemRow: Locator, rating: 0 | 1 | 2 | 3): Promise<void> => {
  await itemRow.hover();
  const starIcon = itemRow.getByTitle('Star this item');

  // Get current rating
  const currentClass = await starIcon.getAttribute('class');
  const currentRating = currentClass?.match(/lpStar(\d)/)?.[1];
  const current = currentRating ? parseInt(currentRating) : 0;

  // Calculate clicks needed (stars cycle 0 -> 1 -> 2 -> 3 -> 0)
  let clicksNeeded = (rating - current + 4) % 4;
  while (clicksNeeded > 0) {
    await starIcon.click();
    clicksNeeded--;
  }
};

/**
 * Removes an item from a category (not from library).
 */
export const removeItemFromCategory = async (itemRow: Locator): Promise<void> => {
  await itemRow.hover();
  await itemRow.getByTitle('Remove this item').click();
};

/**
 * Deletes an item permanently from the library.
 */
export const deleteItemFromLibrary = async (page: Page, libraryItem: Locator): Promise<void> => {
  await libraryItem.hover();
  await libraryItem.getByTitle('Delete this item permanently').click();
  await page.getByRole('button', { name: 'Yes' }).click();
};
