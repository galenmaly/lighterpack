import { test, expect, Page } from '@playwright/test';

import { registerUser, loginUser, generateTestUser } from './auth-utils';
import {
  createCategory,
  addItem,
  enableSetting,
  markItemAsWorn,
  markItemAsConsumable,
  setItemStarRating,
} from './test-helpers';

/**
 * Visual regression baselines for CSS refactoring.
 *
 * Opt-in only (VISUAL=1) so the normal suite is unaffected:
 *   npm run test:visual:update   generate/refresh baselines (run on a clean tree BEFORE refactoring)
 *   npm run test:visual          compare current rendering against the baselines
 *
 * Covers dashboard, share page, and embed page at desktop + mobile
 * viewports in light and dark themes (12 screenshots, chromium only).
 * Theme is driven by prefers-color-scheme emulation: the app follows it via
 * client/utils/theme.js when no lpTheme is stored, and the share/embed pages
 * follow it via the media query in _base.scss.
 *
 * Baselines are machine- and font-specific; generate and compare them on the
 * same machine. Snapshots land in test/e2e/visual.spec.ts-snapshots/.
 */

test.skip(
  ({ browserName }) => browserName !== 'chromium' || !process.env.VISUAL,
  'Visual tests are opt-in: run via npm run test:visual',
);

const SCREENSHOT_OPTS = { animations: 'disabled' as const, maxDiffPixels: 100 };

let credentials: { username: string; password: string; email: string };
let shareUrl: string;
let embedUrl: string;
let externalId: string;

// Same fixture list as share-display.spec.ts: three categories exercising
// worn, consumable, stars, prices, quantities, and item descriptions.
test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  credentials = generateTestUser('visual');
  await registerUser(page, credentials.username, credentials.password, credentials.email);
  await expect(page.getByText('Add new category', { exact: true })).toBeVisible();

  await enableSetting(page, 'List descriptions');
  await enableSetting(page, 'Item prices');

  const listNameInput = page.getByPlaceholder('Name your list', { exact: true });
  await listNameInput.fill('Trail Ready');
  await listNameInput.blur();

  const shelterCategory = await createCategory(page, 'Shelter');
  const tentRow = await addItem(shelterCategory, 'Tent', {
    weight: '8',
    description: 'Double-wall tent',
    price: '100',
  });
  await setItemStarRating(tentRow, 2);

  const clothingCategory = await createCategory(page, 'Clothing');
  const jacketRow = await addItem(clothingCategory, 'Rain Jacket', {
    weight: '4',
    quantity: '2',
  });
  await markItemAsWorn(jacketRow);
  const socksRow = await addItem(clothingCategory, 'Socks', {
    weight: '1',
    quantity: '3',
  });
  await markItemAsConsumable(socksRow);

  const foodCategory = await createCategory(page, 'Food');
  const trailMixRow = await addItem(foodCategory, 'Trail Mix', {
    weight: '2',
    price: '5',
  });
  await markItemAsConsumable(trailMixRow);

  await page.getByText('Share', { exact: true }).hover();
  const shareUrlInput = page.getByLabel('Share your list');
  await expect(shareUrlInput).toHaveValue(/\/r\/[a-zA-Z0-9]+/, { timeout: 10000 });
  shareUrl = await shareUrlInput.inputValue();
  embedUrl = shareUrl.replace('/r/', '/e/');
  const match = shareUrl.match(/\/r\/([a-zA-Z0-9]+)/);
  externalId = match ? match[1] : '';

  await expect(async () => {
    const response = await page.request.get(shareUrl);
    expect(response.status()).toBe(200);
  }).toPass({ timeout: 30000 });

  await page.close();
});

// The pie chart is canvas-drawn after mount; wait for the element, then give
// the draw call a beat to paint before screenshotting.
const settleChart = async (page: Page): Promise<void> => {
  await expect(page.locator('canvas.lpChart').first()).toBeVisible();
  await page.waitForTimeout(400);
};

const viewports = [
  { name: 'desktop', viewport: { width: 1280, height: 800 } },
  { name: 'mobile', viewport: { width: 390, height: 844 } },
] as const;

for (const theme of ['light', 'dark'] as const) {
  for (const { name, viewport } of viewports) {
    test.describe(`${theme} ${name}`, () => {
      test.use({ colorScheme: theme, viewport });

      test('dashboard', async ({ page }) => {
        await loginUser(page, credentials.username, credentials.password);
        await expect(page.getByText('Add new category', { exact: true })).toBeVisible();
        await settleChart(page);
        await expect(page).toHaveScreenshot(`dashboard-${theme}-${name}.png`, {
          ...SCREENSHOT_OPTS,
          // The generated username in the header changes every run.
          mask: [page.locator('.username')],
        });
      });

      test('share page', async ({ page }) => {
        await page.goto(shareUrl);
        await expect(page.getByText('Tent', { exact: true })).toBeVisible();
        await settleChart(page);
        await expect(page).toHaveScreenshot(`share-${theme}-${name}.png`, {
          ...SCREENSHOT_OPTS,
          fullPage: true,
        });
      });

      // The /e/:id endpoint returns a self-bootstrapping script meant for a
      // host page, not an HTML document — host it the same way embed.spec.ts does.
      test('embed page', async ({ page }) => {
        await page.setContent(
          `<!DOCTYPE html>
           <html>
             <head></head>
             <body>
               <div id="${externalId}"></div>
               <script src="${embedUrl}"></script>
             </body>
           </html>`,
          { waitUntil: 'domcontentloaded' },
        );
        await expect(page.locator(`[id="${externalId}"] .lpListName`)).toBeVisible({ timeout: 30000 });
        await expect(page.getByText('Tent', { exact: true })).toBeVisible();
        await settleChart(page);
        await expect(page).toHaveScreenshot(`embed-${theme}-${name}.png`, {
          ...SCREENSHOT_OPTS,
          fullPage: true,
        });
      });
    });
  }
}
