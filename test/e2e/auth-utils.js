import { testRoot } from './utils';

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
  
    await page.fill('.lpRegister input[name="username"]', username);
    await page.fill('.lpRegister input[name="email"]', email);
    await page.fill('.lpRegister input[name="password"]', password);
    await page.fill('.lpRegister input[name="passwordConfirm"]', password);
    await page.getByRole('button').filter({hasText: 'Register'}).click();
}

export async function loginUser(page, username, password) {
    await page.goto(testRoot);
  
    await page.fill('.signin input[name="username"]', username);
    await page.fill('.signin input[name="password"]', password);
    await page.getByRole('button').filter({hasText: 'Sign in'}).click();
}

export async function logoutUser(page) { 
    await page.getByText('Signed in as').hover();
    await page.getByText('Sign out').click();
}