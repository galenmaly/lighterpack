import { test, expect, APIRequestContext } from '@playwright/test';
import crypto from 'crypto';

import { testRoot } from './utils';
import { generateTestUser } from './auth-utils';

const url = (p: string) => new URL(p, testRoot).toString();

test.describe('Forgot Password Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${testRoot}forgot-password`);
    // Wait for the modal to be visible
    await expect(page.locator('#forgotPassword')).toBeVisible();
  });

  test('should display forgot password page with both forms', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Forgot Your Password?' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Forgot Your Username?' })).toBeVisible();
  });

  test('should have username input for password reset', async ({ page }) => {
    const usernameInput = page.locator('form.forgotPassword input.username');
    await expect(usernameInput).toBeVisible();
    await expect(usernameInput).toHaveAttribute('placeholder', 'Username');
  });

  test('should have email input for username recovery', async ({ page }) => {
    const emailInput = page.locator('form.forgotUsername input.email');
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute('placeholder', 'Email Address');
  });

  test('should have return to sign in link', async ({ page }) => {
    const returnLink = page.getByText('Return to sign in');
    await expect(returnLink).toBeVisible();

    await returnLink.click();
    await expect(page).toHaveURL(/\/signin/);
  });

  test('should show error when resetting password for an unknown username', async ({ page }) => {
    // Generated but never registered, so it's guaranteed not to exist
    const { username } = generateTestUser('ghost');
    await page.locator('form.forgotPassword input.username').fill(username);

    const responsePromise = page.waitForResponse(
      (response) => response.url().includes('/forgotPassword') && response.request().method() === 'POST',
    );
    await page.locator('form.forgotPassword input[type="submit"]').click();

    const response = await responsePromise;
    expect(response.status()).toBe(400);
    await expect(page.locator('form.forgotPassword'))
      .toContainText('An error occurred, please try again later.');
  });

  test('should show error when recovering username for an unknown email', async ({ page }) => {
    const { email } = generateTestUser('ghost');
    await page.locator('form.forgotUsername input.email').fill(email);

    const responsePromise = page.waitForResponse(
      (response) => response.url().includes('/forgotUsername') && response.request().method() === 'POST',
    );
    await page.locator('form.forgotUsername input[type="submit"]').click();

    const response = await responsePromise;
    expect(response.status()).toBe(400);
    await expect(page.locator('form.forgotUsername'))
      .toContainText('An error occurred, please try again later.');
  });
});

test.describe('Password reset token flow', () => {
  // Mailgun can't deliver from a test run, so the link is never actually
  // emailed. These tests seed the token row the email would have referenced and
  // drive the real redemption path from there.

  const invalidTokenMessage = 'This password reset link is invalid or has expired. Please request a new one.';

  let knex: any;

  test.beforeAll(async () => {
    const config = (await import('config')).default;
    const Knex = (await import('knex')).default;
    knex = Knex({
      client: 'pg',
      connection: JSON.parse(JSON.stringify(config.get('pgDatabase'))),
    });
  });

  test.afterAll(async () => {
    await knex?.destroy();
  });

  async function registerViaApi(request: APIRequestContext) {
    const user = generateTestUser('reset');
    const response = await request.post(url('/register'), {
      data: { username: user.username, email: user.email, password: user.password },
    });
    expect(response.status()).toBe(200);
    return user;
  }

  // Mirrors what /forgotPassword stores: the raw token goes in the email, only
  // its sha256 is persisted.
  async function seedResetToken(username: string, expiresInMs = 60 * 60 * 1000) {
    const token = crypto.randomBytes(32).toString('hex');
    await knex('users').where({ username }).update({
      reset_token_hash: crypto.createHash('sha256').update(token).digest('hex'),
      reset_token_expires: new Date(Date.now() + expiresInMs),
    });
    return token;
  }

  test('requesting a reset stores a token hash and leaves the password alone', async ({ playwright }) => {
    const request = await playwright.request.newContext();
    const user = await registerViaApi(request);

    const before = await knex('users').select('password').where({ username: user.username });

    // Without Mailgun credentials the send fails and the endpoint reports 500,
    // but the security-relevant invariants below must hold either way.
    await request.post(url('/forgotPassword'), { data: { username: user.username } });

    const after = await knex('users')
      .select('password', 'reset_token_hash', 'reset_token_expires')
      .where({ username: user.username });

    // The old password still works - requesting a reset must not lock the
    // account out, which is exactly what the emailed-password flow did.
    expect(after[0].password).toBe(before[0].password);
    expect(after[0].reset_token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(new Date(after[0].reset_token_expires).getTime()).toBeGreaterThan(Date.now());

    const signin = await request.post(url('/signin'), {
      data: { username: user.username, password: user.password },
    });
    expect(signin.status()).toBe(200);

    await request.dispose();
  });

  test('a second request within the cooldown does not send another link', async ({ playwright }) => {
    const request = await playwright.request.newContext();
    const user = await registerViaApi(request);
    await seedResetToken(user.username); // issued just now

    const before = await knex('users').select('reset_token_hash').where({ username: user.username });

    const response = await request.post(url('/forgotPassword'), { data: { username: user.username } });
    expect(response.status()).toBe(200);

    // An untouched token is the observable proof no second mail was generated.
    const after = await knex('users').select('reset_token_hash').where({ username: user.username });
    expect(after[0].reset_token_hash).toBe(before[0].reset_token_hash);

    await request.dispose();
  });

  test('the link already emailed still works during the cooldown', async ({ playwright }) => {
    const request = await playwright.request.newContext();
    const user = await registerViaApi(request);
    const token = await seedResetToken(user.username);

    await request.post(url('/forgotPassword'), { data: { username: user.username } });

    // Suppressing the resend is only reasonable because the first link is live.
    const response = await request.post(url('/resetPassword'), {
      data: { token, password: 'cooldownpassword' },
    });
    expect(response.status()).toBe(200);

    await request.dispose();
  });

  test('a request after the cooldown issues a fresh token', async ({ playwright }) => {
    const request = await playwright.request.newContext();
    const user = await registerViaApi(request);
    // Expiring in 50 minutes means issued 10 minutes ago against the 1 hour TTL.
    await seedResetToken(user.username, 50 * 60 * 1000);

    const before = await knex('users').select('reset_token_hash').where({ username: user.username });

    // The status depends on whether Mailgun is reachable from the test run;
    // rotating the token is the invariant under test.
    await request.post(url('/forgotPassword'), { data: { username: user.username } });

    const after = await knex('users').select('reset_token_hash').where({ username: user.username });
    expect(after[0].reset_token_hash).not.toBe(before[0].reset_token_hash);
    expect(after[0].reset_token_hash).toMatch(/^[0-9a-f]{64}$/);

    await request.dispose();
  });

  test('a valid token sets the new password and signs the user in', async ({ page, playwright }) => {
    const request = await playwright.request.newContext();
    const user = await registerViaApi(request);
    const token = await seedResetToken(user.username);
    const newPassword = 'brandnewpassword';

    await page.goto(`${testRoot}reset-password/${token}`);
    const form = page.getByTestId('reset-password-form');
    await expect(form).toBeVisible();

    await form.locator('input.password').fill(newPassword);
    await form.locator('input.passwordConfirm').fill(newPassword);
    await form.getByRole('button', { name: 'Save new password' }).click();

    // Auto sign-in drops the user straight on the dashboard.
    await expect(page.getByTestId('account-menu')).toContainText(user.username);

    // The token is cleared on redemption, so the link can't be replayed.
    const rows = await knex('users')
      .select('reset_token_hash', 'reset_token_expires')
      .where({ username: user.username });
    expect(rows[0].reset_token_hash).toBeNull();
    expect(rows[0].reset_token_expires).toBeNull();

    const fresh = await playwright.request.newContext();
    const withNew = await fresh.post(url('/signin'), {
      data: { username: user.username, password: newPassword },
    });
    expect(withNew.status()).toBe(200);

    const withOld = await fresh.post(url('/signin'), {
      data: { username: user.username, password: user.password },
    });
    expect(withOld.status()).toBe(404);

    await fresh.dispose();
    await request.dispose();
  });

  test('an expired token is rejected', async ({ page, playwright }) => {
    const request = await playwright.request.newContext();
    const user = await registerViaApi(request);
    const token = await seedResetToken(user.username, -1000);

    await page.goto(`${testRoot}reset-password/${token}`);
    const form = page.getByTestId('reset-password-form');
    await form.locator('input.password').fill('anotherpassword');
    await form.locator('input.passwordConfirm').fill('anotherpassword');
    await form.getByRole('button', { name: 'Save new password' }).click();

    await expect(form).toContainText(invalidTokenMessage);

    // The original password is untouched.
    const signin = await request.post(url('/signin'), {
      data: { username: user.username, password: user.password },
    });
    expect(signin.status()).toBe(200);

    await request.dispose();
  });

  test('a token cannot be redeemed twice', async ({ playwright }) => {
    const request = await playwright.request.newContext();
    const user = await registerViaApi(request);
    const token = await seedResetToken(user.username);

    const first = await request.post(url('/resetPassword'), {
      data: { token, password: 'firstnewpassword' },
    });
    expect(first.status()).toBe(200);

    const second = await request.post(url('/resetPassword'), {
      data: { token, password: 'secondnewpassword' },
    });
    expect(second.status()).toBe(400);
    expect((await second.json()).errors[0].message).toBe(invalidTokenMessage);

    // The second attempt changed nothing.
    const fresh = await playwright.request.newContext();
    const signin = await fresh.post(url('/signin'), {
      data: { username: user.username, password: 'firstnewpassword' },
    });
    expect(signin.status()).toBe(200);

    await fresh.dispose();
    await request.dispose();
  });

  test('an unknown token is rejected', async ({ playwright }) => {
    const request = await playwright.request.newContext();
    const response = await request.post(url('/resetPassword'), {
      data: { token: crypto.randomBytes(32).toString('hex'), password: 'somenewpassword' },
    });
    expect(response.status()).toBe(400);
    expect((await response.json()).errors[0].message).toBe(invalidTokenMessage);
    await request.dispose();
  });

  test('a too-short password is rejected server-side', async ({ playwright }) => {
    const request = await playwright.request.newContext();
    const user = await registerViaApi(request);
    const token = await seedResetToken(user.username);

    const response = await request.post(url('/resetPassword'), {
      data: { token, password: 'abc' },
    });
    expect(response.status()).toBe(400);
    expect((await response.json()).errors[0].message).toBe('Please enter a password between 5 and 60 characters.');

    await request.dispose();
  });

  // The moderator path is the backstop for when mail delivery itself is what's
  // broken, so it sends nothing and hands the link back to a human to relay.
  // Must match the configured moderator list, so it can't be randomised per
  // run: register it the first time, sign in on every run after that. One
  // account per worker - a user row holds a single session token, so sharing
  // one would have each worker signing the others out mid-test.
  async function signInAsModerator(request: APIRequestContext) {
    const username = `lpe2emoderator${test.info().workerIndex}`;
    const moderator = {
      username,
      email: `${username}@lighterpack.com`,
      password: 'moderatortest',
    };

    const registered = await request.post(url('/register'), { data: moderator });
    if (registered.status() === 200) return;

    const signedIn = await request.post(url('/signin'), {
      data: { username: moderator.username, password: moderator.password },
    });
    expect(signedIn.status()).toBe(200);
  }

  test('a moderator gets a link, and the account keeps working until it is used', async ({ playwright }) => {
    const request = await playwright.request.newContext();
    const user = await registerViaApi(request);
    await request.dispose();

    const mod = await playwright.request.newContext();
    await signInAsModerator(mod);
    const response = await mod.post(url('/moderation/reset-password'), {
      data: { username: user.username },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.resetUrl).toContain('/reset-password/');
    expect(body.newPassword).toBeUndefined();
    await mod.dispose();

    // Nothing was changed yet, so a relay that never lands can't lock them out.
    const asUser = await playwright.request.newContext();
    const stillWorks = await asUser.post(url('/signin'), {
      data: { username: user.username, password: user.password },
    });
    expect(stillWorks.status()).toBe(200);

    const token = body.resetUrl.split('/reset-password/')[1];
    const reset = await asUser.post(url('/resetPassword'), {
      data: { token, password: 'moderatorissued' },
    });
    expect(reset.status()).toBe(200);
    await asUser.dispose();

    const after = await playwright.request.newContext();
    const withNew = await after.post(url('/signin'), {
      data: { username: user.username, password: 'moderatorissued' },
    });
    expect(withNew.status()).toBe(200);
    await after.dispose();
  });

  test('a moderator link is issued even inside the resend cooldown', async ({ playwright }) => {
    const request = await playwright.request.newContext();
    const user = await registerViaApi(request);
    await request.dispose();

    const superseded = await seedResetToken(user.username); // as if a link just went out
    const before = await knex('users').select('reset_token_hash').where({ username: user.username });

    const mod = await playwright.request.newContext();
    await signInAsModerator(mod);
    const response = await mod.post(url('/moderation/reset-password'), {
      data: { username: user.username },
    });
    expect(response.status()).toBe(200);
    await mod.dispose();

    const after = await knex('users').select('reset_token_hash').where({ username: user.username });
    expect(after[0].reset_token_hash).not.toBe(before[0].reset_token_hash);

    // Only one token lives per user, so the one it replaced stops working.
    const asUser = await playwright.request.newContext();
    const stale = await asUser.post(url('/resetPassword'), {
      data: { token: superseded, password: 'stalepassword' },
    });
    expect(stale.status()).toBe(400);
    await asUser.dispose();
  });

  test('the moderation page surfaces a link the user can actually redeem', async ({ page, playwright }) => {
    const request = await playwright.request.newContext();
    const user = await registerViaApi(request);
    await request.dispose();

    // Sign the browser itself in as the moderator so the page can call the
    // moderator-only endpoints.
    const moderator = `lpe2emoderator${test.info().workerIndex}`;
    await page.goto(testRoot);
    const viaBrowser = await page.request.post(url('/register'), {
      data: { username: moderator, email: `${moderator}@lighterpack.com`, password: 'moderatortest' },
    });
    if (viaBrowser.status() !== 200) {
      const signedIn = await page.request.post(url('/signin'), {
        data: { username: moderator, password: 'moderatortest' },
      });
      expect(signedIn.status()).toBe(200);
    }

    await page.goto(`${testRoot}moderation`);
    await page.getByPlaceholder('Search for a user...').fill(user.username);
    await page.getByRole('button', { name: 'Search' }).click();
    await page.locator('.lp-moderation-search-results li', { hasText: user.username }).click();

    await page.getByRole('button', { name: 'Create password reset link' }).click();

    const link = page.locator('.lp-moderation-reset-url code');
    await expect(link).toContainText('/reset-password/');

    // The whole point of the displayed string is that it can be handed over and
    // used, so follow it rather than just asserting on its shape.
    const resetUrl = (await link.textContent())!.trim();
    const asUser = await playwright.request.newContext();
    const reset = await asUser.post(url('/resetPassword'), {
      data: { token: resetUrl.split('/reset-password/')[1], password: 'fromthepanel' },
    });
    expect(reset.status()).toBe(200);
    await asUser.dispose();
  });

  test('mismatched confirmation is caught before any request is sent', async ({ page, playwright }) => {
    const request = await playwright.request.newContext();
    const user = await registerViaApi(request);
    const token = await seedResetToken(user.username);

    let requested = false;
    await page.route('**/resetPassword', (route) => {
      requested = true;
      return route.abort();
    });

    await page.goto(`${testRoot}reset-password/${token}`);
    const form = page.getByTestId('reset-password-form');
    await form.locator('input.password').fill('onepassword');
    await form.locator('input.passwordConfirm').fill('otherpassword');
    await form.getByRole('button', { name: 'Save new password' }).click();

    await expect(form).toContainText("Your passwords don't match.");
    expect(requested).toBe(false);

    await request.dispose();
  });
});
