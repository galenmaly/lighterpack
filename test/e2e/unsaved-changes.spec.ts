import { test, expect } from '@playwright/test';

import { registerUser, generateTestUser } from './auth-utils';
import { testRoot } from './utils';

/**
 * Regression test: loading the app and touching nothing must not produce
 * "unsaved changes".
 *
 * The dirty check compares JSON.stringify(library.save()) against the
 * lastSaveData snapshot taken right after load, so any component that writes
 * onto library objects during render makes an untouched page permanently
 * dirty (and the beforeunload warning fires on every visit). This happened
 * with category.activeHover: hover UI state leaked into saved data, and a
 * library saved while the chart legend was hovered stored activeHover: true,
 * which the first render then reset to false.
 */

// A library as it exists in production data: saved by an earlier client,
// including persisted hover state on a category (saved mid-hover).
const legacyLibrary = (listName: string) => ({
    version: '0.3',
    totalUnit: 'oz',
    itemUnit: 'oz',
    defaultListId: 1,
    sequence: 6,
    showSidebar: true,
    optionalFields: {
        images: false, price: false, worn: true, consumable: true, listDescription: false,
    },
    currencySymbol: '$',
    items: [
        {
            id: 4, name: 'Tent', description: '', weight: 1000, authorUnit: 'oz', price: 0, image: '', imageUrl: '', url: '',
        },
        {
            id: 5, name: 'Stove', description: '', weight: 500, authorUnit: 'oz', price: 0, image: '', imageUrl: '', url: '',
        },
    ],
    categories: [
        {
            id: 2,
            name: 'Shelter',
            categoryItems: [{ qty: 1, worn: 0, consumable: false, star: 0, itemId: 4 }],
            subtotalWeight: 1000,
            subtotalWornWeight: 0,
            subtotalConsumableWeight: 0,
            subtotalPrice: 0,
            subtotalConsumablePrice: 0,
            subtotalQty: 1,
            color: { r: 27, g: 119, b: 211 },
            displayColor: 'rgb(27,119,211)',
            activeHover: true,
        },
        {
            id: 3,
            name: 'Kitchen',
            categoryItems: [{ qty: 1, worn: 0, consumable: false, star: 0, itemId: 5 }],
            subtotalWeight: 500,
            subtotalWornWeight: 0,
            subtotalConsumableWeight: 0,
            subtotalPrice: 0,
            subtotalConsumablePrice: 0,
            subtotalQty: 1,
            color: { r: 206, g: 24, b: 54 },
            displayColor: 'rgb(206,24,54)',
            activeHover: false,
        },
    ],
    lists: [
        {
            id: 1,
            name: listName,
            categoryIds: [2, 3],
            description: '',
            externalId: '',
            totalWeight: 1500,
            totalWornWeight: 0,
            totalConsumableWeight: 0,
            totalBaseWeight: 1500,
            totalPackWeight: 1500,
            totalPrice: 0,
            totalConsumablePrice: 0,
            totalQty: 2,
        },
    ],
});

test.describe('Unsaved changes tracking', () => {
  test('untouched page load has no unsaved changes', async ({ page }) => {
    const { username, password, email } = generateTestUser('untouched');

    await registerUser(page, username, password, email);
    await expect(page.getByText('Welcome to LighterPack!')).toBeVisible();

    // Replace the fresh account's library server-side, simulating an account
    // whose data was written by an earlier version of the app.
    const saveResponse = await page.request.post(`${testRoot}saveLibrary`, {
      data: { sync_token: 0, username, data: JSON.stringify(legacyLibrary('Legacy List')) },
    });
    expect(saveResponse.ok()).toBeTruthy();

    // A fresh page load, then no interaction at all.
    await page.goto(testRoot);
    await expect(page.getByTestId('total-weight')).toBeVisible();
    await page.waitForTimeout(500); // let first-render side effects settle

    // The library must still serialize to exactly what was loaded.
    const dirtyReport = await page.evaluate(() => {
      const state = (window as any).LighterPack.$store.state;
      const current = JSON.stringify(state.library.save());
      const loaded = state.lastSaveData;
      if (current === loaded) return null;
      let i = 0;
      while (i < Math.min(current.length, loaded.length) && current[i] === loaded[i]) i++;
      const from = Math.max(0, i - 60);
      return {
        loaded: loaded.slice(from, i + 80),
        current: current.slice(from, i + 80),
      };
    });
    expect(dirtyReport, 'rendering the page must not change what the library saves').toBeNull();

    // And closing the tab must not warn about unsaved changes.
    let sawUnloadDialog = false;
    page.on('dialog', async (dialog) => {
      sawUnloadDialog = true;
      await dialog.accept();
    });
    await page.close({ runBeforeUnload: true });
    expect(sawUnloadDialog).toBe(false);
  });

  // Local mode saves to localStorage lazily, on the first edit. "Skip
  // registration" builds a fresh Library in memory and writes nothing, so a
  // dirty check that compares against localStorage.library sees a string
  // against undefined and warns before the user has touched anything.
  test('skipping registration has no unsaved changes', async ({ page }) => {
    await page.goto(testRoot);
    await page.getByText('Try it without an account').click();
    await expect(page.locator('#lpListName')).toBeVisible();
    await page.waitForTimeout(500); // let first-render side effects settle

    // Ask the real beforeunload handler directly. Closing the page and
    // watching for the dialog races: page.close() can resolve before the
    // dialog event is delivered, so a missing dialog proves nothing.
    const warnsOnUnload = await page.evaluate(() => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(warnsOnUnload, 'closing an untouched local library must not warn').toBe(false);
  });
});
