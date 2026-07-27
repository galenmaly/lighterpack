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

export async function registerUser(page, username, password, email) {
    await page.goto(testRoot);

    // The phone landing card pairs the two forms as tabs and opens on register.
    // Both panels are mounted, so either form resolves whichever tab is up - it
    // is just hidden until its tab is picked, which reads as a stuck fill().
    const registerTab = page.locator('#lpMobileTabRegister');
    if (await registerTab.isVisible()) {
        await registerTab.click();
    }

    const registerForm = page.getByTestId('register-form');
    await registerForm.getByPlaceholder('Username', { exact: true }).fill(username);
    await registerForm.getByPlaceholder('Email', { exact: true }).fill(email);
    await registerForm.getByPlaceholder('Password', { exact: true }).fill(password);
    await registerForm.getByPlaceholder('Confirm password', { exact: true }).fill(password);
    await registerForm.getByRole('button', { name: 'Register' }).click();
}

export async function loginUser(page, username, password) {
    await page.goto(testRoot);

    // Same as above, from the other side: on a phone the sign-in panel is the
    // one behind a tab.
    const signinTab = page.locator('#lpMobileTabSignin');
    if (await signinTab.isVisible()) {
        await signinTab.click();
    }

    const signinForm = page.getByTestId('signin-form');
    await signinForm.getByPlaceholder('Username', { exact: true }).fill(username);
    await signinForm.getByPlaceholder('Password', { exact: true }).fill(password);
    await signinForm.getByRole('button', { name: 'Sign in' }).click();
}

export async function logoutUser(page) {
    await page.getByTestId('account-menu').hover();
    await Promise.all([
        page.waitForURL('**/signin'),
        page.getByText('Sign out').click(),
    ]);
}
