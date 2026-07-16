import { test, expect } from '@playwright/test';

import { registerUser, generateTestUser } from './auth-utils';

// Helper to open help modal - uses specific link selector to avoid matching username
const openHelpModal = async (page) => {
  await page.getByTestId('account-menu').hover();
  await page.locator('#accountPopover a.lpHref').filter({ hasText: 'Help' }).click();
};

test.describe('Help Modal', () => {
  test.beforeEach(async ({ page }) => {
    // Use prefix that doesn't match 'Help' to avoid selector conflicts
    const { username, password, email } = generateTestUser('hlp');
    await registerUser(page, username, password, email);
    await expect(page.getByText('Welcome to LighterPack!')).toBeVisible();
  });

  test('should open help modal from account dropdown', async ({ page }) => {
    await openHelpModal(page);

    const helpModal = page.locator('#help');
    await expect(helpModal).toBeVisible();
    await expect(helpModal.getByRole('heading', { name: 'Help' })).toBeVisible();
  });

});
