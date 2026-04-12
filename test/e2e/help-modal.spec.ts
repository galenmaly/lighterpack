import { test, expect } from '@playwright/test';

import { registerUser, generateTestUser } from './auth-utils';

// Helper to open help modal - uses specific link selector to avoid matching username
const openHelpModal = async (page) => {
  await page.getByText('Signed in as').hover();
  await page.locator('#headerPopover a.lpHref').filter({ hasText: 'Help' }).click();
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

  test('should display getting started instructions', async ({ page }) => {
    await openHelpModal(page);

    const helpModal = page.locator('#help');
    await expect(helpModal.getByText('Getting Started:')).toBeVisible();
    await expect(helpModal.getByText('Click on things to edit them')).toBeVisible();
    await expect(helpModal.getByText('Add new categories and items')).toBeVisible();
    await expect(helpModal.getByText('share your list with others')).toBeVisible();
  });

  test('should display quantity and worn explanation', async ({ page }) => {
    await openHelpModal(page);

    const helpModal = page.locator('#help');
    await expect(helpModal.getByText('Quantity and worn values')).toBeVisible();
    await expect(helpModal.getByText(/multiple quantity.*worn/i)).toBeVisible();
  });

  test('should display linked items explanation', async ({ page }) => {
    await openHelpModal(page);

    const helpModal = page.locator('#help');
    await expect(helpModal.getByText('Items in multiple lists')).toBeVisible();
    await expect(helpModal.getByText(/linked/i)).toBeVisible();
  });

  test('should display email contact link', async ({ page }) => {
    await openHelpModal(page);

    const helpModal = page.locator('#help');
    const emailLink = helpModal.getByRole('link', { name: /email/i });
    await expect(emailLink).toBeVisible();
    await expect(emailLink).toHaveAttribute('href', 'mailto:info@lighterpack.com');
  });

  test('should close help modal on backdrop click', async ({ page }) => {
    await openHelpModal(page);

    const helpModal = page.locator('#help');
    await expect(helpModal).toBeVisible();

    // Click on the overlay at a corner position (outside the modal content)
    await page.locator('.lpModalOverlay').click({ position: { x: 10, y: 10 } });
    await expect(helpModal).not.toBeVisible();
  });

  test('should close help modal on escape key', async ({ page }) => {
    await openHelpModal(page);

    const helpModal = page.locator('#help');
    await expect(helpModal).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(helpModal).not.toBeVisible();
  });
});
