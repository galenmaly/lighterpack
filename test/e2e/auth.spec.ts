import { test, expect } from '@playwright/test';

import { testRoot } from './utils';

import { registerUser, loginUser, logoutUser, generateTestUser } from './auth-utils';

test.describe('Cookie security', () => {
  let username: string;
  let password: string;

  test.beforeEach(async ({ page }) => {
    const user = generateTestUser('cookie');
    username = user.username;
    password = user.password;
    await registerUser(page, username, password, user.email);
    await expect(page.getByTestId('account-menu')).toContainText(username);
  });

  test('lp cookie is httpOnly', async ({ page }) => {
    const cookies = await page.context().cookies();
    const lp = cookies.find((c) => c.name === 'lp');
    expect(lp).toBeDefined();
    expect(lp!.httpOnly).toBe(true);
  });

  test('lp cookie has sameSite=Lax and ~1 year expiry', async ({ page }) => {
    const cookies = await page.context().cookies();
    const lp = cookies.find((c) => c.name === 'lp');
    expect(lp).toBeDefined();
    expect(lp!.sameSite).toBe('Lax');
    const oneYear = 365 * 24 * 60 * 60;
    const now = Date.now() / 1000;
    expect(lp!.expires).toBeGreaterThan(now + oneYear - 86400);
    expect(lp!.expires).toBeLessThan(now + oneYear + 86400);
  });

  test('lp_loggedin cookie is set and readable by JavaScript', async ({ page }) => {
    const cookies = await page.context().cookies();
    const indicator = cookies.find((c) => c.name === 'lp_loggedin');
    expect(indicator).toBeDefined();
    expect(indicator!.httpOnly).toBe(false);
    const visibleToJs = await page.evaluate(() => document.cookie.includes('lp_loggedin='));
    expect(visibleToJs).toBe(true);
  });

  test('session persists across page reload', async ({ page }) => {
    await page.reload();
    await expect(page.getByTestId('account-menu')).toContainText(username);
  });

  test('signout clears cookies and invalidates the session token server-side', async ({ page }) => {
    const cookiesBefore = await page.context().cookies();
    const lpBefore = cookiesBefore.find((c) => c.name === 'lp');
    expect(lpBefore).toBeDefined();

    await logoutUser(page);

    const cookies = await page.context().cookies();
    expect(cookies.find((c) => c.name === 'lp_loggedin')).toBeUndefined();

    // Replaying the pre-signout session cookie must no longer authenticate
    const response = await page.request.post(`${testRoot}saveLibrary/`, {
      headers: { Cookie: `lp=${lpBefore!.value}` },
      data: {},
    });
    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body.message).toContain('log in');
  });
});

test.describe('Cookie security — guest flow', () => {
  test('guest with no cookies and no localStorage stays on welcome page', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto(testRoot);
    await page.evaluate(() => localStorage.clear());
    await page.goto(testRoot);

    // Should not be redirected to /signin
    await expect(page).not.toHaveURL(/\/signin/);
    // Should show the welcome/landing content
    await expect(page.getByText('Sign in', { exact: true }).first()).toBeVisible();
  });
});

test.describe('User Authentication Tests', () => {
  test('should successfully register a new user', async ({ page }) => {
    await page.goto(testRoot);

    const { username, password, email } = generateTestUser('test');

    await registerUser(page, username, password, email);
    await expect(page.getByTestId('account-menu')).toContainText(username);
    await expect(page.getByText('Welcome to LighterPack!')).toBeVisible();
  });

  test('should successfully log in an existing user', async ({ page }) => {
    await page.goto(testRoot);

    // Register a new user first, then log out and log back in
    const { username, password, email } = generateTestUser('login');

    await registerUser(page, username, password, email);
    await logoutUser(page);

    await loginUser(page, username, password);
    await expect(page.getByTestId('account-menu')).toContainText(username);
    await expect(page.getByText('Welcome to LighterPack!')).toBeVisible();
  });

  test('should successfully change password', async ({ page }) => {
    await page.goto(testRoot);

    const { username, password, email } = generateTestUser('pw');
    const newPassword = 'testtest2';

    await registerUser(page, username, password, email);
    await page.getByTestId('account-menu').hover();
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
    await page.getByTestId('account-menu').hover();
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

    // The account must actually be gone: logging in with the same credentials fails
    await loginUser(page, username, password);
    await expect(page.getByTestId('signin-form').locator('.lpError')).toBeVisible();
    await expect(page.getByTestId('account-menu')).not.toBeVisible();
  });

  test('accepts confirmation text with the trailing space a phone keyboard adds', async ({ page }) => {
    await page.goto(testRoot);

    const { username, password, email } = generateTestUser('deltrim');

    await registerUser(page, username, password, email);
    await page.getByTestId('account-menu').hover();
    await page.getByText('Account Settings').click();
    await page.getByText('Delete Account').click();

    const deleteModal = page.locator('.lpModal').filter({ hasText: 'delete my account' });
    await deleteModal.getByPlaceholder('Current password').fill(password);
    await deleteModal.getByPlaceholder('Confirmation text').fill('Delete my account ');

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

    await page.getByText('Try it without an account', { exact: true }).click();
    await expect(page.getByText('Welcome to LighterPack!')).toBeVisible();

    const listNameInput = page.getByPlaceholder('Name your list', { exact: true });
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
    await expect(page.getByPlaceholder('Name your list', { exact: true })).toHaveValue('Local Data List');
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
