import { test, expect, Page, Locator } from '@playwright/test';

import { generateTestUser, registerUser } from './auth-utils';
import { addItem, createCategory } from './test-helpers';
import { testRoot } from './utils';

/**
 * The phone layout.
 *
 * Below $mobile (720px, client/css/_globals.scss) the app swaps in two
 * components a media query can't express — item-mobile.vue and
 * list-summary-mobile.vue, keyed off client/utils/viewport.js — and the rail
 * becomes an overlay drawer. None of that is reachable from the desktop specs.
 *
 * The viewport and touch emulation are set per-file rather than by adding a
 * Playwright project, so these run in the normal suite and the desktop specs
 * are left alone.
 */
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 900 };

test.use({ viewport: PHONE, hasTouch: true });

/** The saved rail preference, which the phone drawer must never write to. */
const readShowSidebar = (page: Page) => page.evaluate(
  () => (window as unknown as { LighterPack: any }).LighterPack.$store.state.library.showSidebar,
);

const readItemNames = (page: Page) => page.evaluate(
  () => (window as unknown as { LighterPack: any }).LighterPack.$store.state.library.items.map((i: any) => i.name),
);

/** A new list and a new category each arrive with one blank row already there. */
async function fillFirstRow(category: Locator, name: string, description: string, weight: string) {
  const row = category.getByTestId('item-row').first();
  await row.getByPlaceholder('Name', { exact: true }).fill(name);
  await row.getByPlaceholder('Description', { exact: true }).fill(description);
  await row.getByTestId('item-weight').fill(weight);
  await row.getByPlaceholder('Name', { exact: true }).blur();
  return row;
}

/**
 * Registers, then builds a two-category list through the desktop UI before
 * dropping back to the phone viewport. The fixture is built with the proven
 * desktop helpers on purpose: these tests are about how the phone layout
 * behaves, not about entering data on a phone. The one test that does care
 * about phone data entry drives the editor itself.
 */
async function signUpWithList(page: Page) {
  const user = generateTestUser('mobile');
  await registerUser(page, user.username, user.password, user.email);
  await expect(page.getByText('Add new category', { exact: true })).toBeVisible({ timeout: 20000 });

  await page.setViewportSize(DESKTOP);
  await page.locator('#lpListName').fill('Denali');

  const carry = page.getByTestId('category').first();
  await carry.getByPlaceholder('Category Name', { exact: true }).fill('Carry');
  await carry.getByPlaceholder('Category Name', { exact: true }).blur();
  await fillFirstRow(carry, 'Duffel bag', 'REI XXL', '34');
  await addItem(carry, 'Backpack', { description: 'Mountain Hardwear BMG', weight: '83' });

  const sleep = await createCategory(page, 'Sleep');
  await fillFirstRow(sleep, 'Sleeping Bag', 'Montbell Down Expedition', '55');
  // Deliberately weightless. The v-else regression only showed on rows with
  // nothing to draw a weight bar from, so the fixture keeps one around.
  await addItem(sleep, 'Stuff sack', { description: 'weightless on purpose' });

  await page.setViewportSize(PHONE);
  await expect(page.getByTestId('summary-strip')).toBeVisible();
}

test.describe('Phone layout', () => {
  test('swaps in the phone row and summary, and swaps back', async ({ page }) => {
    await signUpWithList(page);

    await expect(page.getByTestId('item-rest').first()).toBeVisible();
    await expect(page.getByTestId('summary-strip')).toBeVisible();
    // The desktop summary and grid rows are gone, not just restyled.
    await expect(page.locator('.lpListSummary')).toHaveCount(0);
    await expect(page.locator('.lpItem')).toHaveCount(0);

    await page.setViewportSize(DESKTOP);
    await expect(page.locator('.lpListSummary')).toHaveCount(1);
    await expect(page.locator('.lpItem').first()).toBeVisible();
    await expect(page.getByTestId('item-rest')).toHaveCount(0);
    await expect(page.getByTestId('summary-strip')).toHaveCount(0);
  });
});

test.describe('Phone item rows', () => {
  // The regression this pins: the editor's v-else once paired with a
  // neighbouring v-if instead of the rest row's, so any row that failed that
  // other condition rendered its editor open, on load, with nothing to dismiss
  // it. The fixture's weightless row is the case that used to trip it.
  test('no row opens its editor on its own, including a weightless one', async ({ page }) => {
    await signUpWithList(page);
    await expect(page.getByTestId('item-editor')).toHaveCount(0);
    await expect(page.getByTestId('item-rest')).toHaveCount(4);
    await expect(page.getByTestId('item-rest').filter({ hasText: 'Stuff sack' })).toHaveCount(1);
  });

  test('adding an item opens its editor with the name focused', async ({ page }) => {
    await signUpWithList(page);
    const restBefore = await page.getByTestId('item-rest').count();

    await page.getByText('Add new item', { exact: true }).first().tap();

    const editor = page.getByTestId('item-editor');
    await expect(editor).toHaveCount(1);
    // One row swapped into the editor, and the new row accounts for the rest.
    await expect(page.getByTestId('item-rest')).toHaveCount(restBefore);
    await expect(editor.getByPlaceholder('Name', { exact: true })).toBeFocused();

    // And it's a genuinely new, empty row rather than an existing one reopened.
    await expect(editor.getByPlaceholder('Name', { exact: true })).toHaveValue('');
  });

  test('tapping a row opens exactly one editor, and tapping outside closes it', async ({ page }) => {
    await signUpWithList(page);

    const row = page.getByTestId('item-row').first();
    await page.getByTestId('item-rest').first().tap();
    await expect(page.getByTestId('item-editor')).toHaveCount(1);

    // The row slides between its two heights. slideTo() drives the height, but
    // it only animates if the CSS side is wired; losing that snaps silently.
    expect(await row.evaluate(el => getComputedStyle(el).transitionDuration)).not.toBe('0s');
    // And the height goes back to auto once settled, or the row stops tracking
    // its own contents.
    await expect.poll(() => row.evaluate(el => el.style.height)).toBe('');

    // The opening tap reaches the document dismisser too, after the row has
    // re-rendered — so a plain containment test would see a detached target,
    // call it an outside tap, and close what it just opened.
    await page.locator('#lpFooter').tap();
    await expect(page.getByTestId('item-editor')).toHaveCount(0);
  });

  // Dismissing on pointerdown re-rendered the list between pointerdown and
  // click, so the row moved out from under the tap: the open row closed and
  // the tapped one never opened. On a phone that reads as a dead first tap.
  test('opening another row closes the first and opens the one tapped', async ({ page }) => {
    await signUpWithList(page);

    await page.getByTestId('item-rest').filter({ hasText: 'Duffel bag' }).tap();
    await expect(page.getByTestId('item-editor')).toHaveCount(1);

    await page.getByTestId('item-rest').filter({ hasText: 'Backpack' }).tap();
    await expect(page.getByTestId('item-editor')).toHaveCount(1);
    await expect(page.getByTestId('item-editor').getByPlaceholder('Name', { exact: true }))
      .toHaveValue('Backpack');
  });

  // Deleting a category full of items is too big an action to sit one stray
  // tap away when there's no hover to keep the control out of the way.
  test('the category delete only appears once the category is empty', async ({ page }) => {
    await signUpWithList(page);

    const carry = page.getByTestId('category').first();
    const removeCategory = carry.locator('.lpRemoveCategory');
    await expect(carry.getByTestId('item-rest')).toHaveCount(2);
    await expect(removeCategory).toBeHidden();

    for (let i = 0; i < 2; i++) {
      await carry.getByTestId('item-rest').first().tap();
      await carry.getByTestId('mobile-remove-item').tap();
    }

    await expect(carry.getByTestId('item-rest')).toHaveCount(0);
    await expect(removeCategory).toBeVisible();
  });

  test('edits made in the editor reach the library', async ({ page }) => {
    await signUpWithList(page);

    await page.getByTestId('item-rest').first().tap();
    const editor = page.getByTestId('item-editor');
    await expect(editor).toBeVisible();

    await editor.getByPlaceholder('Name', { exact: true }).fill('Duffel bag XL');
    await editor.getByTestId('item-weight').fill('36');
    await page.locator('#lpFooter').tap();

    await expect(page.getByTestId('item-editor')).toHaveCount(0);
    await expect(page.getByTestId('item-rest').first()).toContainText('Duffel bag XL');
    await expect(page.getByTestId('item-rest').first()).toContainText('36');
    expect(await readItemNames(page)).toContain('Duffel bag XL');
  });

  // The unit picker sits inside the weight field rather than beside it. When
  // that field's name was a wrapping <label>, the tap opening the picker was
  // forwarded on to the weight input, and the click that produced reached the
  // document listener the picker had just bound — so it opened and shut in the
  // same gesture, and the unit could never be changed from a phone.
  test('the unit picker in the editor opens and changes the unit', async ({ page }) => {
    await signUpWithList(page);

    await page.getByTestId('item-rest').first().tap();
    const picker = page.getByTestId('item-editor').getByTestId('unit-select');
    await picker.tap();

    const menu = picker.locator('.lpUnitDropdown');
    await expect(menu).toBeVisible();

    await menu.locator('li.lb').tap();
    await expect(picker).toContainText('lb');
  });
});

test.describe('Phone item search', () => {
  /** Gear that exists in the library but isn't placed in this list. */
  async function stashInLibrary(page: Page, name: string, description: string, weight: string) {
    await page.setViewportSize(DESKTOP);
    const category = page.getByTestId('category').last();
    await addItem(category, name, { description, weight });
    await page.evaluate((itemName) => {
      const { $store } = (window as unknown as { LighterPack: any }).LighterPack;
      const { library } = $store.state;
      const list = library.getListById(library.defaultListId);
      const owner = library.getCategoryById(list.categoryIds[list.categoryIds.length - 1]);
      const item = library.items.find((candidate: any) => candidate.name === itemName);
      $store.commit('removeItemFromCategory', { itemId: item.id, category: owner });
    }, name);
    await page.setViewportSize(PHONE);
  }

  const libraryNames = (page: Page) => page.evaluate(
    () => (window as unknown as { LighterPack: any }).LighterPack.$store.state.library.items
      .map((item: any) => item.name),
  );

  test('typing a name suggests matching gear from the library', async ({ page }) => {
    await signUpWithList(page);
    await stashInLibrary(page, 'Pillow', 'Nemo Fillo', '2.9');
    await stashInLibrary(page, 'Pill organizer', '', '0.8');

    await page.getByText('Add new item', { exact: true }).first().tap();
    const editor = page.getByTestId('item-editor');
    await editor.getByPlaceholder('Name', { exact: true }).fill('pil');

    await expect(page.getByTestId('item-suggestion')).toHaveCount(2);
    // Name-prefix matches rank first, so "Pillow" leads.
    await expect(page.getByTestId('item-suggestion').first()).toContainText('Pillow');
    await expect(page.getByTestId('item-suggestion').first()).toContainText('Nemo Fillo');
  });

  test('picking a suggestion links the existing gear rather than duplicating it', async ({ page }) => {
    await signUpWithList(page);
    await stashInLibrary(page, 'Pillow', 'Nemo Fillo', '2.9');
    const before = (await libraryNames(page)).length;

    await page.getByText('Add new item', { exact: true }).first().tap();
    await page.getByTestId('item-editor').getByPlaceholder('Name', { exact: true }).fill('pil');
    await page.getByTestId('item-suggestion').first().tap();

    // The row is now the library's Pillow, weight and all.
    const row = page.getByTestId('item-rest').filter({ hasText: 'Pillow' });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('2.9');
    await expect(page.getByTestId('item-editor')).toHaveCount(0);

    // The blank row it replaced is gone, and no second "Pillow" was created —
    // copying the values across instead of linking would have left both.
    const after = await libraryNames(page);
    expect(after.filter(name => name === 'Pillow')).toHaveLength(1);
    expect(after).toHaveLength(before);
  });

  test('gear already in the list is not suggested', async ({ page }) => {
    await signUpWithList(page);

    await page.getByText('Add new item', { exact: true }).first().tap();
    // "Duffel bag" is in the list already, so there is nothing to offer.
    await page.getByTestId('item-editor').getByPlaceholder('Name', { exact: true }).fill('duffel');
    await expect(page.getByTestId('item-suggestions')).toHaveCount(0);
  });

  test('an established row is never offered a replacement', async ({ page }) => {
    await signUpWithList(page);
    await stashInLibrary(page, 'Pillow', 'Nemo Fillo', '2.9');

    // This row has a weight and description, so it's an edit, not an add.
    await page.getByTestId('item-rest').filter({ hasText: 'Duffel bag' }).tap();
    await page.getByTestId('item-editor').getByPlaceholder('Name', { exact: true }).fill('pil');

    await expect(page.getByTestId('item-suggestions')).toHaveCount(0);
  });
});

test.describe('Phone header', () => {
  // These menus only ever opened on mouseenter, which a touch screen never
  // fires — Share, Settings and the account menu were all unreachable. The tap
  // handler is gated on (hover: none), which hasTouch does switch on here (both
  // chromium and firefox report hover: none, pointer: coarse under it).
  test('menus open on tap, not only on hover', async ({ page }) => {
    await signUpWithList(page);

    const popover = page.locator('#accountPopover .lpPopover');
    await expect(popover).not.toHaveClass(/lpPopoverShown/);

    await page.getByTestId('account-menu').tap();
    await expect(popover).toHaveClass(/lpPopoverShown/);
  });

  // The tap handler that opens these menus sat on a wrapper around the whole
  // popover, content included, so every tap on a control inside one was read
  // as another tap on the button that opens it. Settings was unusable: the
  // toggles are labels, which fire a second click on their checkbox, so the
  // menu closed and reopened on each one — a visible flash of the scrim — and
  // the currency box closed the menu outright before it could take focus.
  test('a toggle inside a menu leaves the menu open', async ({ page }) => {
    await signUpWithList(page);

    await page.locator('#settings .lpTarget').tap();
    const popover = page.locator('#settings .lpPopover');
    await expect(popover).toHaveClass(/lpPopoverShown/);

    // Watch the open/closed state across the tap rather than only after it: a
    // close followed by a reopen settles back on "shown" and sails past a bare
    // end-state assertion. The class is what the scrim's v-if keys off, and it
    // flips even when the leave transition is cancelled before the scrim
    // actually leaves the DOM.
    await page.evaluate(() => {
      const w = window as unknown as { __shownFlips: number };
      w.__shownFlips = 0;
      new MutationObserver(() => { w.__shownFlips += 1; })
        .observe(document.querySelector('#settings .lpPopover')!, {
          attributes: true,
          attributeFilter: ['class'],
        });
    });

    await page.getByText('Item prices', { exact: true }).tap();

    await expect(popover).toHaveClass(/lpPopoverShown/);
    await expect(page.getByTestId('popover-scrim')).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __shownFlips: number }).__shownFlips)).toBe(0);
    expect(await page.locator('#lpOptionalFields input').nth(1).isChecked()).toBe(true);
  });

  test('the currency box inside the Settings menu takes focus', async ({ page }) => {
    await signUpWithList(page);

    await page.locator('#settings .lpTarget').tap();
    await page.getByText('Item prices', { exact: true }).tap();

    const currency = page.locator('#currencySymbol');
    await expect(currency).toBeVisible();
    await currency.tap();

    await expect(page.locator('#settings .lpPopover')).toHaveClass(/lpPopoverShown/);
    await expect(currency).toBeFocused();

    await currency.fill('£');
    await expect(page.locator('#settings .lpPopover')).toHaveClass(/lpPopoverShown/);
  });

  // Picking an action from a menu still has to dismiss it — otherwise the menu
  // and its scrim sit over whatever the action just opened.
  test('choosing an action from a menu dismisses it', async ({ page }) => {
    await signUpWithList(page);

    await page.getByTestId('account-menu').tap();
    await expect(page.locator('#accountPopover .lpPopover')).toHaveClass(/lpPopoverShown/);

    await page.locator('#accountPopover .lpContent').getByText('Help', { exact: true }).tap();

    await expect(page.locator('#accountPopover .lpPopover')).not.toHaveClass(/lpPopoverShown/);
    await expect(page.getByTestId('popover-scrim')).toHaveCount(0);
  });

  // The dark-mode switch lives in the same menu as those actions and must not
  // be swept up by them.
  test('the dark mode switch leaves the account menu open', async ({ page }) => {
    await signUpWithList(page);

    await page.getByTestId('account-menu').tap();
    const wasDark = await page.getByTestId('dark-mode-toggle').isChecked();

    await page.locator('#accountPopover .lpContent').getByText('Dark mode', { exact: true }).tap();

    await expect(page.locator('#accountPopover .lpPopover')).toHaveClass(/lpPopoverShown/);
    expect(await page.getByTestId('dark-mode-toggle').isChecked()).toBe(!wasDark);
  });
});

test.describe('Phone chrome fits the viewport', () => {
  // Two rounds of review caught misaligned app-bar controls by eye: the avatar
  // carried a desktop baseline nudge, and font-size: 0 (which drops the action
  // labels) collapsed the line box the icons sat on, hanging them 2px high.
  test('every app bar control sits on the header centre', async ({ page }) => {
    await signUpWithList(page);

    const centreOf = async (selector: string) => {
      const box = await page.locator(selector).boundingBox();
      expect(box, `${selector} has no box`).not.toBeNull();
      return box!.y + box!.height / 2;
    };

    const header = await centreOf('#header');
    for (const control of [
      '#hamburger',
      '#lpListName',
      '#share .lpTarget .lpSprite',
      '#settings .lpTarget .lpSprite',
      '.lpAvatar',
    ]) {
      expect(Math.abs(await centreOf(control) - header), `${control} off centre`).toBeLessThanOrEqual(1);
    }
  });

  // Header menus centre themselves on their control, which sits a few pixels
  // from the right edge — the Share menu opened 19px past the left of the
  // screen.
  for (const menu of ['#share', '#settings', '#accountPopover']) {
    test(`the ${menu} menu opens within the screen`, async ({ page }) => {
      await signUpWithList(page);

      await page.locator(`${menu} .lpTarget`).tap();
      const content = page.locator(`${menu} .lpContent`);
      await expect(content).toBeVisible();

      const box = await content.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(PHONE.width);
    });
  }

  // There's no hover to reveal a menu on a phone, so the tap that dismisses one
  // used to carry on into whatever was underneath — usually an item row, which
  // opened its editor.
  test('a menu dismisses on its scrim without opening an item editor', async ({ page }) => {
    await signUpWithList(page);

    await page.locator('#settings .lpTarget').tap();
    const scrim = page.getByTestId('popover-scrim');
    await expect(scrim).toBeVisible();

    // Down where the item rows are, which the scrim now covers.
    await scrim.tap({ position: { x: 195, y: 520 } });

    await expect(page.locator('#settings .lpPopover')).not.toHaveClass(/lpPopoverShown/);
    await expect(page.getByTestId('item-editor')).toHaveCount(0);
  });

  test('an open menu dims the page but not the app bar', async ({ page }) => {
    await signUpWithList(page);
    await page.locator('#settings .lpTarget').tap();
    await expect(page.getByTestId('popover-scrim')).toBeVisible();

    const layers = await page.evaluate(() => {
      const scrim = document.querySelector('.lpPopoverScrim') as HTMLElement;
      const header = document.querySelector('#header') as HTMLElement;
      return {
        insideHeader: header.contains(scrim),
        scrimZ: Number(getComputedStyle(scrim).zIndex),
        headerZ: Number(getComputedStyle(header).zIndex),
      };
    });

    // The menu positions itself against the sticky header, so without being
    // teleported out the scrim is stuck in the header's stacking context and
    // dims the header too — whatever its z-index.
    expect(layers.insideHeader).toBe(false);
    expect(layers.scrimZ).toBeLessThan(layers.headerZ);
  });

  // A 260px chart beside a fixed 450px column scrolled the whole page sideways.
  test('the get-started view does not scroll the page sideways', async ({ page }) => {
    const user = generateTestUser('start');
    await registerUser(page, user.username, user.password, user.email);
    await expect(page.locator('#getStarted')).toBeVisible({ timeout: 20000 });

    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(PHONE.width);
  });
});

test.describe('Phone summary', () => {
  test('the scoreboard strip expands and collapses', async ({ page }) => {
    await signUpWithList(page);

    const panel = page.getByTestId('summary-panel');

    await expect(panel).toBeHidden();
    await page.getByTestId('summary-strip').tap();
    await expect(panel).toBeVisible();
    await expect(page.getByTestId('total-weight')).toBeVisible();

    // The panel grows rather than appearing. Asserting the transition is wired
    // rather than sampling mid-flight keeps this off the clock; the height
    // itself is driven from JS, so losing the CSS side would snap silently.
    const duration = await panel.evaluate(el => getComputedStyle(el).transitionDuration);
    expect(duration).not.toBe('0s');

    await page.getByTestId('summary-strip').tap();
    await expect(panel).toBeHidden();
  });
});

test.describe('Phone drawer', () => {
  test('opens and closes without writing the saved rail preference', async ({ page }) => {
    await signUpWithList(page);
    const main = page.locator('#main');
    const savedBefore = await readShowSidebar(page);

    await page.getByTestId('toggle-sidebar').tap();
    await expect(main).toHaveClass(/lpDrawerOpen/);
    // The whole reason the drawer keeps its own flag: library.showSidebar is
    // serialized with the library, so driving the drawer with it would write a
    // phone gesture into the desktop rail preference.
    expect(await readShowSidebar(page)).toBe(savedBefore);

    // Tapping past the drawer's right edge, which is where the scrim is
    // actually exposed — the drawer sits above it.
    await page.touchscreen.tap(360, 500);
    await expect(main).not.toHaveClass(/lpDrawerOpen/);
    expect(await readShowSidebar(page)).toBe(savedBefore);
  });

  // On the desktop the flyout is already open on hover, so clicking "+ New"
  // outright is a shortcut. With no hover the tap has to open the menu instead,
  // or choosing "Add new list" from it would be the second list created.
  test('+ New opens the list menu rather than creating a list', async ({ page }) => {
    await signUpWithList(page);
    const rows = page.locator('.lpLibraryList');

    await page.getByTestId('toggle-sidebar').tap();
    const before = await rows.count();

    await page.getByTestId('new-list').tap();
    await expect(page.locator('#addListFlyout .lpPopover')).toHaveClass(/lpPopoverShown/);
    expect(await rows.count()).toBe(before);

    await page.getByTestId('new-list-blank').tap();
    await expect(rows).toHaveCount(before + 1);
  });

  test('picking a list closes the drawer', async ({ page }) => {
    await signUpWithList(page);
    // Created through the store rather than the sidebar UI, which is covered
    // by list-management.spec.ts and not what's under test here.
    await page.evaluate(() => (window as unknown as { LighterPack: any }).LighterPack.$store.commit('newList'));
    await page.setViewportSize(PHONE);

    await page.getByTestId('toggle-sidebar').tap();
    await expect(page.locator('#main')).toHaveClass(/lpDrawerOpen/);

    const inactive = page.locator('.lpLibraryList:not(.lpActive)').first();
    await inactive.tap();

    await expect(page.locator('#main')).not.toHaveClass(/lpDrawerOpen/);
  });
});

test.describe('Gear library screen', () => {
  const openGear = async (page: Page) => {
    await page.getByTestId('toggle-sidebar').tap();
    await page.getByTestId('drawer-gear').tap();
    await expect(page.getByTestId('gear-search')).toBeVisible();
  };

  test('the drawer links to it, and back returns to the list', async ({ page }) => {
    await signUpWithList(page);
    await openGear(page);

    expect(page.url()).toContain('/gear');
    await expect(page.getByTestId('gear-row')).toHaveCount(4);
    // Everything built above is already in the list.
    await expect(page.getByTestId('gear-in-list')).toHaveCount(4);

    await page.getByTestId('gear-back').tap();
    await expect(page.getByTestId('summary-strip')).toBeVisible();
  });

  test('adding gear through the category picker puts it in the list', async ({ page }) => {
    await signUpWithList(page);

    // Gear that exists in the library but not in this list: add it, then drop
    // it from the category, which leaves the library item behind. The removal
    // goes through the store rather than the row's ✕ — that control is
    // revealed on hover, and hover emulation is off in this file.
    await page.setViewportSize(DESKTOP);
    const sleep = page.getByTestId('category').last();
    await addItem(sleep, 'Tent', { description: 'Big Agnes Fly Creek 2', weight: '34' });
    await page.evaluate(() => {
      const { $store } = (window as unknown as { LighterPack: any }).LighterPack;
      const { library } = $store.state;
      const list = library.getListById(library.defaultListId);
      const category = library.getCategoryById(list.categoryIds[list.categoryIds.length - 1]);
      const tent = library.items.find((item: any) => item.name === 'Tent');
      $store.commit('removeItemFromCategory', { itemId: tent.id, category });
    });
    await page.setViewportSize(PHONE);

    await openGear(page);
    await expect(page.getByTestId('gear-add')).toHaveCount(1);

    await page.getByTestId('gear-add').first().tap();
    await expect(page.getByTestId('gear-picker')).toBeVisible();
    // Both categories offered, named.
    await expect(page.getByTestId('gear-picker-category')).toHaveCount(2);

    await page.getByTestId('gear-picker-category').first().tap();

    await expect(page.getByTestId('gear-picker')).toHaveCount(0);
    await expect(page.getByTestId('gear-add')).toHaveCount(0);
    await expect(page.getByTestId('gear-in-list')).toHaveCount(5);

    // And it's really in the list, not just badged.
    await page.getByTestId('gear-back').tap();
    await expect(page.getByTestId('item-rest').filter({ hasText: 'Tent' })).toHaveCount(1);
  });

  test('search and the "not in list" filter narrow the rows', async ({ page }) => {
    await signUpWithList(page);
    await openGear(page);

    await page.getByTestId('gear-search').fill('sleep');
    await expect(page.getByTestId('gear-row')).toHaveCount(1);
    await page.getByTestId('gear-search').fill('');
    await expect(page.getByTestId('gear-row')).toHaveCount(4);

    // Everything is in the list, so this filter should empty the screen.
    await page.getByTestId('gear-filter-notInList').tap();
    await expect(page.getByTestId('gear-row')).toHaveCount(0);
    await expect(page.locator('.lpGearEmpty')).toBeVisible();
  });
});

test.describe('Phone onboarding', () => {
  // The landing page puts both forms in one tabbed card (design 8a), so the
  // desktop panels are not reflowed at this width -- a separate block renders.
  test('opens on Sign in, and the card holds everything needed to act', async ({ page }) => {
    await page.goto(testRoot);

    const card = page.locator('.lpMobileCard');
    await expect(card).toBeVisible({ timeout: 20000 });

    // Sign in is the default tab; the register fields are mounted but hidden.
    await expect(page.getByTestId('signin-form')).toBeVisible();
    await expect(page.getByTestId('register-form')).toBeHidden();

    // Nothing required to act is below the fold at 390x844.
    const strip = page.locator('.lpMobileAnon');
    await expect(strip).toBeVisible();
    const bottom = await strip.evaluate((el) => el.getBoundingClientRect().bottom);
    expect(bottom).toBeLessThan(PHONE.height);
  });

  test('the Register tab swaps the form without moving the strip below it', async ({ page }) => {
    await page.goto(testRoot);
    await expect(page.locator('.lpMobileCard')).toBeVisible({ timeout: 20000 });

    const stripTop = () => page.locator('.lpMobileAnon')
      .evaluate((el) => el.getBoundingClientRect().top);
    const before = await stripTop();

    await page.locator('#lpMobileTabRegister').tap();
    const form = page.getByTestId('register-form');
    await expect(form).toBeVisible();
    await expect(page.getByTestId('signin-form')).toBeHidden();

    // Four fields instead of two, so the card grows and the strip moves with
    // it rather than staying put or jumping somewhere else.
    expect(await stripTop()).toBeGreaterThan(before);

    // Validation still renders inside the card.
    await form.getByRole('button', { name: 'Register' }).tap();
    await expect(page.getByText('Please enter a username.')).toBeVisible();
  });

  test('typing survives a round trip between the tabs', async ({ page }) => {
    await page.goto(testRoot);
    await expect(page.locator('.lpMobileCard')).toBeVisible({ timeout: 20000 });

    const username = page.getByTestId('signin-form').getByPlaceholder('Username');
    await username.fill('roundtrip');

    await page.locator('#lpMobileTabRegister').tap();
    await expect(page.getByTestId('register-form')).toBeVisible();
    await page.locator('#lpMobileTabSignin').tap();

    await expect(username).toHaveValue('roundtrip');
  });

  test('starting without an account goes straight into a list', async ({ page }) => {
    await page.goto(testRoot);
    await expect(page.locator('.lpMobileCard')).toBeVisible({ timeout: 20000 });

    await page.locator('.lpMobileAnonLink').tap();

    // Into the app itself, saving locally -- no account, no interstitial.
    await expect(page.locator('.lpMobileCard')).toBeHidden();
    await expect(page.getByTestId('category').first()).toBeVisible({ timeout: 20000 });
    expect(new URL(page.url()).pathname).toBe('/');
    expect(await page.evaluate(
      () => (window as unknown as { LighterPack: any }).LighterPack.$store.state.saveType,
    )).toBe('local');
  });

  test('a register intent in the url opens on the Register tab', async ({ page }) => {
    await page.goto(`${testRoot}welcome?register`);

    await expect(page.getByTestId('register-form')).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('signin-form')).toBeHidden();
  });
});
