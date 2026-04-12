import { testRoot } from './utils';

/**
 * Generate unique test credentials to avoid collisions in parallel test execution.
 * Combines timestamp with random suffix for guaranteed uniqueness.
 * Username is truncated to 32 characters (the max allowed).
 */
export function generateTestUser(prefix = 'test') {
    const now = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const fullUsername = `${prefix}${now}${random}`;
    const username = fullUsername.substring(0, 32); // Max 32 chars allowed
    const email = `${prefix}+${now}${random}@lighterpack.com`;
    const password = 'testtest';
    return { username, email, password };
}

export async function getSharedUser() {
    /* TODO: after migrating to postgres have this method actually create the user if it doesn't already exist. */
    /* TODO: should also be a uniqueUser method for tests that alter the user state */

    const password = 'testtest';
    const username = 'testuser';
    const email = 'testuser@lighterpack.com';

    return { username, password, email };
}

export async function registerUser(page, username, password, email) {
    await page.goto(testRoot);

    const registerForm = page.getByTestId('register-form');
    await registerForm.getByPlaceholder('Username', { exact: true }).fill(username);
    await registerForm.getByPlaceholder('Email', { exact: true }).fill(email);
    await registerForm.getByPlaceholder('Password', { exact: true }).fill(password);
    await registerForm.getByPlaceholder('Confirm password', { exact: true }).fill(password);
    await registerForm.getByRole('button', { name: 'Register' }).click();
}

export async function loginUser(page, username, password) {
    await page.goto(testRoot);

    const signinForm = page.getByTestId('signin-form');
    await signinForm.getByPlaceholder('Username', { exact: true }).fill(username);
    await signinForm.getByPlaceholder('Password', { exact: true }).fill(password);
    await signinForm.getByRole('button', { name: 'Sign in' }).click();
}

export async function logoutUser(page) { 
    await page.getByText('Signed in as').hover();
    await page.getByText('Sign out').click();
}
