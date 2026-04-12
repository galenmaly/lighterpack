import { test, expect } from '@playwright/test';

import { testRoot } from './utils';

import { registerUser, loginUser, logoutUser, generateTestUser } from './auth-utils';

test('has title', async ({ page }) => {
  await page.goto(testRoot);

  await expect(page).toHaveTitle(/LighterPack/);
});

test.describe('User Authentication Tests', () => {
  test('should successfully register a new user', async ({ page }) => {
    await page.goto(testRoot);

    const { username, password, email } = generateTestUser('test');

    await registerUser(page, username, password, email);
    await expect(page.getByText(`Signed in as ${username}`)).toBeVisible();
    await expect(page.getByText('Welcome to LighterPack!')).toBeVisible();
  });

  test('should successfully log in an existing user', async ({ page }) => {
    await page.goto(testRoot);

    // Register a new user first, then log out and log back in
    const { username, password, email } = generateTestUser('login');

    await registerUser(page, username, password, email);
    await logoutUser(page);

    await loginUser(page, username, password);
    await expect(page.getByText(`Signed in as ${username}`)).toBeVisible();
    await expect(page.getByText('Welcome to LighterPack!')).toBeVisible();
  });

  test('should successfully log out', async ({ page }) => {
    await page.goto(testRoot);

    // Register a new user first
    const { username, password, email } = generateTestUser('logout');

    await registerUser(page, username, password, email);
    await logoutUser(page);
    await expect(page.getByRole('heading').filter({hasText: 'Sign in'})).toBeVisible();
  });

  test('should successfully change password', async ({ page }) => {
    await page.goto(testRoot);

    const { username, password, email } = generateTestUser('pw');
    const newPassword = 'testtest2';

    await registerUser(page, username, password, email);
    await page.getByText('Signed in as').hover();
    await page.getByText('Account Settings').click();

    await page.getByPlaceholder('New Password', { exact: true }).fill(newPassword);
    await page.getByPlaceholder('Confirm New Password').fill(newPassword);

    await page.getByText('Submit').click();

    await expect(page.getByText('Please enter your current password.')).toBeVisible();

    // Use the password input in the account settings modal
    await page.locator('.lpModal').getByPlaceholder('Current password').fill(password);

    await page.getByText('Submit').click();
    await expect(page.getByRole('heading').filter({hasText: 'Account Settings'})).toBeHidden();

    await logoutUser(page);

    await expect(page.getByText('Welcome to LighterPack!')).toBeHidden();

    await loginUser(page, username, newPassword);

    await expect(page.getByText('Welcome to LighterPack!')).toBeVisible();
  });

  test('should successfully delete a user', async ({ page }) => {
    await page.goto(testRoot);

    const { username, password, email } = generateTestUser('del');

    await registerUser(page, username, password, email);
    await page.getByText('Signed in as').hover();
    await page.getByText('Account Settings').click();
    await page.getByText('Delete Account').click();
    await page.getByText('Permanently delete account').click();

    await expect(page.getByText('Please enter your current password.')).toBeVisible();
    await expect(page.getByText('Please enter the confirmation text.')).toBeVisible();

    // Use more specific selector for the delete modal password field
    const deleteModal = page.locator('.lpModal').filter({ hasText: 'delete my account' });
    await deleteModal.getByPlaceholder('Current password').fill(password);
    await deleteModal.getByPlaceholder('Confirmation text').fill('delete my account');

    await page.getByText('Permanently delete account').click();
    await expect(page.getByRole('heading').filter({hasText: 'Sign in'})).toBeVisible();
  });

  test('should show validation errors when registering with missing fields', async ({ page }) => {
    await page.goto(testRoot);

    const registerForm = page.getByTestId('register-form');
    await registerForm.getByRole('button', { name: 'Register' }).click();

    await expect(registerForm.locator('.lpError')).toContainText('Please enter a username.');
    await expect(registerForm.locator('.lpError')).toContainText('Please enter an email.');
    await expect(registerForm.locator('.lpError')).toContainText('Please enter a password.');
    await expect(registerForm.locator('.lpError')).toContainText('Please enter a password confirmation.');
  });

  test('should show password mismatch error on registration', async ({ page }) => {
    await page.goto(testRoot);

    const registerForm = page.getByTestId('register-form');
    await registerForm.getByPlaceholder('Username', { exact: true }).fill('mismatchUser');
    await registerForm.getByPlaceholder('Email', { exact: true }).fill('mismatch@example.com');
    await registerForm.getByPlaceholder('Password', { exact: true }).fill('testtest');
    await registerForm.getByPlaceholder('Confirm password', { exact: true }).fill('testtest2');
    await registerForm.getByRole('button', { name: 'Register' }).click();

    await expect(registerForm.locator('.lpError')).toContainText("Your passwords don't match.");
  });

  test('should block duplicate usernames and emails during registration', async ({ page }) => {
    await page.goto(testRoot);

    const { username, password, email } = generateTestUser('dupe');
    await registerUser(page, username, password, email);
    await logoutUser(page);

    await page.goto(`${testRoot}register`);
    const registerForm = page.getByTestId('register-form');
    await registerForm.getByPlaceholder('Username', { exact: true }).fill(username);
    await registerForm.getByPlaceholder('Email', { exact: true }).fill(`alt+${email}`);
    await registerForm.getByPlaceholder('Password', { exact: true }).fill(password);
    await registerForm.getByPlaceholder('Confirm password', { exact: true }).fill(password);
    await registerForm.getByRole('button', { name: 'Register' }).click();

    await expect(registerForm.locator('.lpError')).toContainText('That username already exists, please pick a different username.');

    await registerForm.getByPlaceholder('Username', { exact: true }).fill(`${username}2`);
    await registerForm.getByPlaceholder('Email', { exact: true }).fill(email);
    await registerForm.getByRole('button', { name: 'Register' }).click();

    await expect(registerForm.locator('.lpError')).toContainText('A user with that email already exists.');
  });

  test('should show validation errors when signing in without credentials', async ({ page }) => {
    await page.goto(testRoot);

    const signinForm = page.getByTestId('signin-form');
    await signinForm.getByRole('button', { name: 'Sign in' }).click();

    await expect(signinForm.locator('.lpError')).toContainText('Please enter a username.');
    await expect(signinForm.locator('.lpError')).toContainText('Please enter a password.');
  });

  test('should show an error for invalid sign in credentials', async ({ page }) => {
    await page.goto(testRoot);

    const signinForm = page.getByTestId('signin-form');
    await signinForm.getByPlaceholder('Username', { exact: true }).fill('invalid-user');
    await signinForm.getByPlaceholder('Password', { exact: true }).fill('invalid-pass');
    await signinForm.getByRole('button', { name: 'Sign in' }).click();

    await expect(signinForm.locator('.lpError')).toBeVisible();
  });

  test('should preserve local data when registering', async ({ page }) => {
    await page.goto(testRoot);

    await page.getByText('Skip registration', { exact: true }).click();
    await expect(page.getByText('Welcome to LighterPack!')).toBeVisible();

    const listNameInput = page.getByPlaceholder('List Name', { exact: true });
    await listNameInput.fill('Local Data List');
    await listNameInput.blur();

    await page.waitForFunction(() => {
      const store = window.LighterPack && window.LighterPack.$store;
      return store && store.state.library && typeof store.state.library.save === 'function';
    });
    await page.evaluate(() => {
      const store = window.LighterPack.$store;
      localStorage.library = JSON.stringify(store.state.library.save());
    });

    await page.goto(`${testRoot}register`);

    const { username, password, email } = generateTestUser('local');
    const registerForm = page.getByTestId('register-form');
    await registerForm.getByPlaceholder('Username', { exact: true }).fill(username);
    await registerForm.getByPlaceholder('Email', { exact: true }).fill(email);
    await registerForm.getByPlaceholder('Password', { exact: true }).fill(password);
    await registerForm.getByPlaceholder('Confirm password', { exact: true }).fill(password);
    await registerForm.getByRole('button', { name: 'Register' }).click();

    await expect(page.getByText('Welcome to LighterPack!')).toBeVisible();
    await expect(page.getByPlaceholder('List Name', { exact: true })).toHaveValue('Local Data List');
  });

  test('should return out-of-date error from API when sync token mismatches', async ({ page }) => {
    const { username, password, email } = generateTestUser('sync');

    await registerUser(page, username, password, email);

    await page.waitForFunction(() => {
      const store = window.LighterPack && window.LighterPack.$store;
      return store && store.state.library && typeof store.state.library.save === 'function';
    });

    const savePayload = await page.evaluate(() => {
      const store = window.LighterPack.$store;
      return {
        syncToken: store.state.syncToken,
        username: store.state.loggedIn,
        saveData: JSON.stringify(store.state.library.save()),
      };
    });

    const response = await page.request.post(`${testRoot}saveLibrary/`, {
      data: {
        sync_token: savePayload.syncToken + 1,
        username: savePayload.username,
        data: savePayload.saveData,
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.message).toContain('out of date');
  });
});
