import { test, expect, APIRequestContext } from '@playwright/test';
import { generateTestUser } from './auth-utils';
import { testRoot } from './utils';
import { Library } from '../../client/dataTypes.js';

// API-level contract tests. These hit the server directly (no browser UI) and
// pin the status codes and messages the client depends on.

const url = (p: string) => new URL(p, testRoot).toString();

async function registerViaApi(request: APIRequestContext) {
    const user = generateTestUser('api');
    const response = await request.post(url('/register'), {
        data: { username: user.username, email: user.email, password: user.password },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    return { ...user, library: body.library, sync_token: body.sync_token };
}

test.describe('/signin contract', () => {
    test('no credentials and no cookie returns 401', async ({ playwright }) => {
        const request = await playwright.request.newContext();
        const response = await request.post(url('/signin'), { data: {} });
        expect(response.status()).toBe(401);
        expect((await response.json()).message).toBe('Please log in.');
        await request.dispose();
    });

    test('unknown username returns 404 with invalid-credentials message', async ({ playwright }) => {
        const request = await playwright.request.newContext();
        const response = await request.post(url('/signin'), {
            data: { username: `no-such-user-${Date.now()}`, password: 'testtest' },
        });
        expect(response.status()).toBe(404);
        expect((await response.json()).message).toBe('Invalid username and/or password.');
        await request.dispose();
    });

    test('wrong password returns 404 with invalid-credentials message', async ({ playwright }) => {
        const request = await playwright.request.newContext();
        const user = await registerViaApi(request);
        await request.post(url('/signout'));

        const response = await request.post(url('/signin'), {
            data: { username: user.username, password: 'not-the-password' },
        });
        expect(response.status()).toBe(404);
        expect((await response.json()).message).toBe('Invalid username and/or password.');
        await request.dispose();
    });

    test('valid credentials return the library and set an httpOnly session cookie', async ({ playwright }) => {
        const request = await playwright.request.newContext();
        const user = await registerViaApi(request);
        await request.post(url('/signout'));

        const response = await request.post(url('/signin'), {
            data: { username: user.username, password: user.password },
        });
        expect(response.status()).toBe(200);
        const body = await response.json();
        expect(body.username).toBe(user.username);
        expect(typeof body.library).toBe('string');
        expect(body.sync_token).toBe(0);

        const setCookies = response.headersArray().filter((h) => h.name.toLowerCase() === 'set-cookie');
        const lpCookie = setCookies.find((h) => h.value.startsWith('lp='));
        expect(lpCookie).toBeDefined();
        expect(lpCookie!.value).toContain('HttpOnly');
        await request.dispose();
    });
});

test.describe('/saveLibrary contract', () => {
    test('unauthenticated save returns 401', async ({ playwright }) => {
        const request = await playwright.request.newContext();
        const response = await request.post(url('/saveLibrary'), {
            data: { sync_token: 0, username: 'whoever', data: '{}' },
        });
        expect(response.status()).toBe(401);
        expect((await response.json()).message).toBe('Please log in.');
        await request.dispose();
    });

    test('missing sync_token returns 400', async ({ playwright }) => {
        const request = await playwright.request.newContext();
        const user = await registerViaApi(request);
        const response = await request.post(url('/saveLibrary'), {
            data: { username: user.username, data: user.library },
        });
        expect(response.status()).toBe(400);
        expect(await response.text()).toContain('refresh this page');
        await request.dispose();
    });

    test('missing data returns 400', async ({ playwright }) => {
        const request = await playwright.request.newContext();
        const user = await registerViaApi(request);
        const response = await request.post(url('/saveLibrary'), {
            data: { sync_token: 0, username: user.username },
        });
        expect(response.status()).toBe(400);
        expect((await response.json()).message).toContain('refresh your browser');
        await request.dispose();
    });

    test('saving as a different username returns 401', async ({ playwright }) => {
        const request = await playwright.request.newContext();
        const user = await registerViaApi(request);
        const response = await request.post(url('/saveLibrary'), {
            data: { sync_token: 0, username: `${user.username}x`, data: user.library },
        });
        expect(response.status()).toBe(401);
        expect((await response.json()).message).toContain('login again');
        await request.dispose();
    });

    test('unparseable library JSON returns 400', async ({ playwright }) => {
        const request = await playwright.request.newContext();
        const user = await registerViaApi(request);
        const response = await request.post(url('/saveLibrary'), {
            data: { sync_token: 0, username: user.username, data: 'not-json{' },
        });
        expect(response.status()).toBe(400);
        expect((await response.json()).errors[0].message).toContain('unable to parse');
        await request.dispose();
    });

    test('valid save returns success and increments sync_token', async ({ playwright }) => {
        const request = await playwright.request.newContext();
        const user = await registerViaApi(request);
        const response = await request.post(url('/saveLibrary'), {
            data: { sync_token: 0, username: user.username, data: user.library },
        });
        expect(response.status()).toBe(200);
        const body = await response.json();
        expect(body.message).toBe('success');
        expect(body.sync_token).toBe(1);
        await request.dispose();
    });

    test('a stale sync_token is rejected with 400 (no lost update)', async ({ playwright }) => {
        const request = await playwright.request.newContext();
        const user = await registerViaApi(request);

        const first = await request.post(url('/saveLibrary'), {
            data: { sync_token: 0, username: user.username, data: user.library },
        });
        expect(first.status()).toBe(200);

        // reusing the now-stale token must not overwrite the first save
        const second = await request.post(url('/saveLibrary'), {
            data: { sync_token: 0, username: user.username, data: user.library },
        });
        expect(second.status()).toBe(400);
        expect((await second.json()).message).toContain('out of date');
        await request.dispose();
    });
});

test.describe('/forgotPassword and /forgotUsername contracts', () => {
    test('empty username returns 400 validation error', async ({ playwright }) => {
        const request = await playwright.request.newContext();
        const response = await request.post(url('/forgotPassword'), { data: { username: '' } });
        expect(response.status()).toBe(400);
        expect((await response.json()).errors[0].message).toBe('Please enter a username.');
        await request.dispose();
    });

    test('unknown username returns 400 without leaking existence details', async ({ playwright }) => {
        const request = await playwright.request.newContext();
        const response = await request.post(url('/forgotPassword'), {
            data: { username: `no-such-user-${Date.now()}` },
        });
        expect(response.status()).toBe(400);
        expect((await response.json()).message).toBe('An error occurred.');
        await request.dispose();
    });

    test('empty email returns 400 validation error', async ({ playwright }) => {
        const request = await playwright.request.newContext();
        const response = await request.post(url('/forgotUsername'), { data: { email: '' } });
        expect(response.status()).toBe(400);
        expect((await response.json()).errors[0].message).toBe('Please enter a valid email.');
        await request.dispose();
    });

    test('unknown email returns 400', async ({ playwright }) => {
        const request = await playwright.request.newContext();
        const response = await request.post(url('/forgotUsername'), {
            data: { email: `nobody-${Date.now()}@lighterpack.com` },
        });
        expect(response.status()).toBe(400);
        expect((await response.json()).message).toBe('An error occurred');
        await request.dispose();
    });
});

test.describe('/moderation contract', () => {
    test('anonymous moderation search returns 401', async ({ playwright }) => {
        const request = await playwright.request.newContext();
        const response = await request.get(url('/moderation/search?q=test'));
        expect(response.status()).toBe(401);
        expect((await response.json()).message).toBe('Please log in.');
        await request.dispose();
    });

    test('regular signed-in user is denied moderation search with 403', async ({ playwright }) => {
        const request = await playwright.request.newContext();
        await registerViaApi(request);
        const response = await request.get(url('/moderation/search?q=test'));
        expect(response.status()).toBe(403);
        expect((await response.json()).message).toBe('Denied.');
        await request.dispose();
    });

    test('regular signed-in user is denied moderation password reset with 403', async ({ playwright }) => {
        const request = await playwright.request.newContext();
        await registerViaApi(request);
        const response = await request.post(url('/moderation/reset-password'), {
            data: { username: 'whoever' },
        });
        expect(response.status()).toBe(403);
        expect((await response.json()).message).toBe('Denied.');
        await request.dispose();
    });
});

test.describe('/imageUpload contract', () => {
    test('an unauthenticated upload returns 401', async ({ playwright }) => {
        const request = await playwright.request.newContext();
        const response = await request.post(url('/imageUpload'), {
            multipart: { notimage: 'value' },
        });
        expect(response.status()).toBe(401);
        await request.dispose();
    });

    test('upload without an image returns 400', async ({ playwright }) => {
        const request = await playwright.request.newContext();
        await registerViaApi(request);
        const response = await request.post(url('/imageUpload'), {
            multipart: { notimage: 'value' },
        });
        expect(response.status()).toBe(400);
        expect((await response.json()).message).toBe('No image provided.');
        await request.dispose();
    });

    test('a file that is not an image is rejected with 400', async ({ playwright }) => {
        const request = await playwright.request.newContext();
        await registerViaApi(request);
        const response = await request.post(url('/imageUpload'), {
            multipart: { image: { name: 'fake.png', mimeType: 'image/png', buffer: Buffer.from('not actually a png, just some text padding') } },
        });
        expect(response.status()).toBe(400);
        expect((await response.json()).message).toContain('JPEG, PNG, or WebP');
        await request.dispose();
    });

    test('an image larger than 5MB is rejected with 413', async ({ playwright }) => {
        const request = await playwright.request.newContext();
        await registerViaApi(request);
        const oversized = Buffer.alloc(6 * 1024 * 1024, 0);
        const response = await request.post(url('/imageUpload'), {
            multipart: { image: { name: 'big.png', mimeType: 'image/png', buffer: oversized } },
        });
        expect(response.status()).toBe(413);
        expect((await response.json()).message).toContain('5MB');
        await request.dispose();
    });
});

test.describe('/register email validation', () => {
    test('a malformed email is rejected with 400', async ({ playwright }) => {
        const request = await playwright.request.newContext();
        const user = generateTestUser('api');
        const response = await request.post(url('/register'), {
            data: { username: user.username, email: 'not-an-email', password: user.password },
        });
        expect(response.status()).toBe(400);
        const errors = (await response.json()).errors;
        expect(errors.some((e: { message: string }) => e.message === 'Please enter a valid email.')).toBe(true);
        await request.dispose();
    });
});

test.describe('/account email change', () => {
    test('re-submitting your own current email is not treated as a conflict', async ({ playwright }) => {
        const request = await playwright.request.newContext();
        const user = await registerViaApi(request);
        const response = await request.post(url('/account'), {
            data: { currentPassword: user.password, newEmail: user.email },
        });
        expect(response.status()).toBe(200);
        expect((await response.json()).message).toBe('success');
        await request.dispose();
    });
});

test.describe('/delete-account contract', () => {
    test('a user who has shared a list can still delete their account', async ({ playwright }) => {
        // Regression: list rows FK-reference the user, so deleting a sharer used
        // to fail with a foreign-key violation (500) until the delete cascaded.
        const request = await playwright.request.newContext();
        const user = await registerViaApi(request);

        const ext = await request.post(url('/externalId'));
        expect(ext.status()).toBe(200);

        const del = await request.post(url('/delete-account'), {
            data: { username: user.username, password: user.password },
        });
        expect(del.status()).toBe(200);
        expect((await del.json()).message).toBe('success');
        await request.dispose();
    });
});

test.describe('share page URL sanitization', () => {
    test('a javascript: item URL is not rendered as a link on the share page', async ({ playwright }) => {
        const request = await playwright.request.newContext();
        const user = await registerViaApi(request);

        // Build a library with a malicious URL item and a safe-URL control item.
        const lib = new Library();
        const list = lib.lists[0];
        list.name = 'Sanitization';
        const category = lib.categories[0];

        const evil = lib.items[0];
        evil.name = 'EvilItem';
        evil.url = 'javascript:window.__xss=true';

        const safe = lib.newItem({ category });
        safe.name = 'SafeItem';
        safe.url = 'https://example.com/ok';

        const save1 = await request.post(url('/saveLibrary'), {
            data: { sync_token: 0, username: user.username, data: JSON.stringify(lib.save()) },
        });
        expect(save1.status()).toBe(200);
        const syncToken = (await save1.json()).sync_token;

        // Mint a share id, attach it to the list, and save again.
        const ext = await request.post(url('/externalId'));
        const externalId = (await ext.json()).externalId;
        list.externalId = externalId;
        const save2 = await request.post(url('/saveLibrary'), {
            data: { sync_token: syncToken, username: user.username, data: JSON.stringify(lib.save()) },
        });
        expect(save2.status()).toBe(200);

        const page = await request.get(url(`/r/${externalId}`));
        expect(page.status()).toBe(200);
        const html = await page.text();

        expect(html).toContain('EvilItem'); // item still appears...
        expect(html).not.toContain('javascript:'); // ...but its unsafe URL is dropped entirely
        // the safe-URL item still renders as a link (mustache HTML-escapes the href, e.g. / -> &#x2F;)
        expect(html).toContain('SafeItem');
        expect(html).toContain('lpHref');
        expect(html).toContain('example.com');
        await request.dispose();
    });
});

test.describe('legacy sha3 password upgrade on signin', () => {
    // Legacy users (pre-bcrypt) have passwords stored either as a raw sha3 hash
    // or as bcrypt-of-sha3. verifyPassword upgrades both to plain bcrypt on
    // first successful login. A regression here locks out every legacy user.

    let knex: any;
    let CryptoJS: any;

    test.beforeAll(async () => {
        const config = (await import('config')).default;
        const Knex = (await import('knex')).default;
        knex = Knex({
            client: 'pg',
            connection: JSON.parse(JSON.stringify(config.get('pgDatabase'))),
        });

        CryptoJS = (await import('../../server/sha3.js')).default;
    });

    test.afterAll(async () => {
        await knex?.destroy();
    });

    for (const variant of ['raw sha3', 'bcrypt of sha3'] as const) {
        test(`${variant} password still signs in and is rehashed to bcrypt`, async ({ playwright }) => {
            const request = await playwright.request.newContext();
            const user = await registerViaApi(request);
            await request.post(url('/signout'));

            const sha3password = CryptoJS.SHA3(user.password + user.username).toString(CryptoJS.enc.Base64);
            let legacyStored = sha3password;
            if (variant === 'bcrypt of sha3') {
                const bcrypt = (await import('bcryptjs')).default;
                legacyStored = await bcrypt.hash(sha3password, 10);
            }
            await knex('users').where({ username: user.username }).update({ password: legacyStored });

            const response = await request.post(url('/signin'), {
                data: { username: user.username, password: user.password },
            });
            expect(response.status()).toBe(200);

            // the stored hash is upgraded to bcrypt-of-plain-password
            const rows = await knex('users').select('password').where({ username: user.username });
            expect(rows[0].password).not.toBe(legacyStored);
            expect(rows[0].password).toMatch(/^\$2/);

            // and a second signin succeeds through the normal bcrypt path
            await request.post(url('/signout'));
            const again = await request.post(url('/signin'), {
                data: { username: user.username, password: user.password },
            });
            expect(again.status()).toBe(200);
            await request.dispose();
        });
    }
});
