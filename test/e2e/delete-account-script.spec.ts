import { test, expect } from '@playwright/test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';

// Covers scripts/delete-account.js, the operator-side deletion used when a
// person cannot practically delete their accounts themselves. Its safety
// properties are the ones you least want to find broken after the fact: that a
// dry run really changes nothing, that the backup exists before the row is
// gone, and that --restore actually reconstitutes what was deleted.
//
// Talks to the same dev database the rest of the suite uses. Every fixture is
// namespaced with the prefix below and cleanup is scoped to it, so a bug in
// here cannot reach a real account.

const execFileAsync = promisify(execFile);

const PREFIX = 'lpe2edel';
const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const BACKUP_DIR = path.join(REPO_ROOT, 'logs', 'deleted-accounts');

const LIBRARY = {
    version: '0.4',
    items: [{ id: 1, name: 'Tent' }, { id: 2, name: 'Quilt' }],
    lists: [{ id: 1, name: 'JMT' }],
};

test.describe('delete-account script', () => {
    let knex: any;
    let userImageLocation: (id: string) => { dir: string };

    test.beforeAll(async () => {
        const config = (await import('config')).default;
        const Knex = (await import('knex')).default;
        knex = Knex({
            client: 'pg',
            connection: JSON.parse(JSON.stringify(config.get('pgDatabase'))),
        });
        ({ userImageLocation } = await import('../../server/images.js'));
    });

    test.afterAll(async () => {
        await knex?.destroy();
    });

    /**
     * Insert an account directly. /register refuses a duplicate email, and the
     * whole point of this script is the accounts that share one -- so the second
     * row of a shared-address pair can only be made by hand, the same way the
     * mongo import made the 5,213 that exist in production.
     */
    async function makeUser(name: string, email: string, opts: { shareLinks?: number; images?: number } = {}) {
        const [row] = await knex('users').insert({
            username: name,
            email,
            token: `token-${name}`,
            password: 'not-a-real-hash',
            library: JSON.stringify(LIBRARY),
            sync_token: 3,
            registered: new Date(),
            last_seen: new Date(),
        }).returning('*');

        for (let i = 0; i < (opts.shareLinks ?? 0); i++) {
            await knex('list').insert({ external_id: `${name}-ext-${i}`, user_id: row.user_id });
        }
        if (opts.images) {
            const { dir } = userImageLocation(row.user_id);
            fs.mkdirSync(dir, { recursive: true });
            for (let i = 0; i < opts.images; i++) fs.writeFileSync(path.join(dir, `img${i}.webp`), 'fake');
        }
        return row;
    }

    async function runScript(args: string[]) {
        try {
            const { stdout } = await execFileAsync('node', ['scripts/delete-account.js', ...args], {
                cwd: REPO_ROOT,
                encoding: 'utf8',
            });
            return { code: 0, stdout };
        } catch (err: any) {
            return { code: err.code ?? 1, stdout: err.stdout ?? '', stderr: err.stderr ?? '' };
        }
    }

    async function usernames(email: string) {
        const rows = await knex('users').whereRaw('lower(email) = ?', [email.toLowerCase()]).select('username');
        return rows.map((r: any) => r.username).sort();
    }

    // Unique per test so parallel workers cannot collide on an address.
    let email: string;
    let stamp: string;

    /**
     * The same address as `email` to every reader and to lower(email), but a
     * distinct string to postgres. Needed because this dev database carries a
     * UNIQUE(email) that db/01_users.sql deliberately does not declare -- see
     * its comment on the 5,213 shared addresses in the export. Production, which
     * holds those rows, cannot have the constraint. Using a case variant keeps
     * the fixture buildable against either schema.
     */
    const sameAddressDifferentCase = () => email.toUpperCase();

    test.beforeEach(() => {
        stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
        email = `${PREFIX}${stamp}@lighterpack.com`;
    });

    // Scoped to this test's own stamp, not the whole prefix: spec files run in
    // parallel, and a prefix-wide sweep would delete a sibling test's fixtures
    // while it was still using them.
    test.afterEach(async () => {
        const mine = `${PREFIX}${stamp}`;
        const rows = await knex('users').whereLike('username', `${mine}%`);
        for (const row of rows) {
            await knex('list').where({ user_id: row.user_id }).del();
            fs.rmSync(userImageLocation(row.user_id).dir, { recursive: true, force: true });
        }
        await knex('users').whereLike('username', `${mine}%`).del();

        if (fs.existsSync(BACKUP_DIR)) {
            for (const file of fs.readdirSync(BACKUP_DIR)) {
                if (file.startsWith(mine)) fs.rmSync(path.join(BACKUP_DIR, file));
            }
        }
    });

    test('a dry run reports both accounts on a shared address and deletes nothing', async () => {
        await makeUser(`${PREFIX}${stamp}a`, email, { shareLinks: 2, images: 2 });
        await makeUser(`${PREFIX}${stamp}b`, sameAddressDifferentCase(), { shareLinks: 1 });

        const { code, stdout } = await runScript(['--email', email]);

        expect(code).toBe(0);
        expect(stdout).toContain('Dry run: true');
        // Found across the case difference -- matching is on lower(email).
        expect(stdout).toContain(`${PREFIX}${stamp}a`);
        expect(stdout).toContain(`${PREFIX}${stamp}b`);
        expect(stdout).toContain('2 share links');
        expect(stdout).toContain('2 image files');
        expect(stdout).toContain('Nothing was deleted');

        expect(await usernames(email)).toEqual([`${PREFIX}${stamp}a`, `${PREFIX}${stamp}b`]);
        // This test's own stamp, not the prefix: siblings write backups too.
        const backups = fs.existsSync(BACKUP_DIR)
            ? fs.readdirSync(BACKUP_DIR).filter((f) => f.startsWith(`${PREFIX}${stamp}`))
            : [];
        expect(backups).toEqual([]);
    });

    test('--live deletes every account on the address, with its lists and images', async () => {
        const a = await makeUser(`${PREFIX}${stamp}a`, email, { shareLinks: 2, images: 2 });
        await makeUser(`${PREFIX}${stamp}b`, sameAddressDifferentCase(), { shareLinks: 1 });
        const imageDir = userImageLocation(a.user_id).dir;

        const { code, stdout } = await runScript(['--email', email, '--live']);

        expect(code).toBe(0);
        expect(stdout).toContain('OPERATOR account delete');
        expect(await usernames(email)).toEqual([]);

        // No orphaned share links, and the photos are off disk.
        const strayLists = await knex('list').whereLike('external_id', `${PREFIX}${stamp}%`);
        expect(strayLists).toHaveLength(0);
        expect(fs.existsSync(imageDir)).toBe(false);

        // One backup per account, holding the row it deleted.
        const backups = fs.readdirSync(BACKUP_DIR).filter((f) => f.startsWith(`${PREFIX}${stamp}`));
        expect(backups).toHaveLength(2);
        const dumped = JSON.parse(fs.readFileSync(path.join(BACKUP_DIR, backups.find((f) => f.includes(`${stamp}a`))!), 'utf8'));
        expect(dumped.user.username).toBe(`${PREFIX}${stamp}a`);
        expect(dumped.user.library.items).toHaveLength(2);
        expect(dumped.lists).toHaveLength(2);
    });

    test('--only deletes just the named account and leaves its neighbour', async () => {
        await makeUser(`${PREFIX}${stamp}a`, email, { shareLinks: 1 });
        await makeUser(`${PREFIX}${stamp}b`, sameAddressDifferentCase());

        const { code, stdout } = await runScript(['--email', email, '--only', `${PREFIX}${stamp}b`, '--live']);

        expect(code).toBe(0);
        expect(stdout).toContain('1 excluded by --only');
        expect(await usernames(email)).toEqual([`${PREFIX}${stamp}a`]);
    });

    test('--only refuses a name that is not among the matches, changing nothing', async () => {
        await makeUser(`${PREFIX}${stamp}a`, email);

        const { code } = await runScript(['--email', email, '--only', 'someoneelse', '--live']);

        expect(code).toBe(1);
        expect(await usernames(email)).toEqual([`${PREFIX}${stamp}a`]);
    });

    test('--restore brings back the account and its share links', async () => {
        await makeUser(`${PREFIX}${stamp}a`, email, { shareLinks: 2 });
        await runScript(['--email', email, '--live']);
        expect(await usernames(email)).toEqual([]);

        const backup = fs.readdirSync(BACKUP_DIR).find((f) => f.startsWith(`${PREFIX}${stamp}a`))!;
        const backupPath = path.join('logs', 'deleted-accounts', backup);

        const dry = await runScript(['--restore', backupPath]);
        expect(dry.stdout).toContain('Dry run');
        expect(await usernames(email)).toEqual([]);

        const { code } = await runScript(['--restore', backupPath, '--live']);
        expect(code).toBe(0);

        const [restored] = await knex('users').where({ username: `${PREFIX}${stamp}a` });
        expect(restored.sync_token).toBe(3);
        expect(restored.library.items).toHaveLength(2);
        const links = await knex('list').where({ user_id: restored.user_id });
        expect(links).toHaveLength(2);

        // The backup is spent: restoring it twice would duplicate the account.
        const again = await runScript(['--restore', backupPath, '--live']);
        expect(again.code).toBe(1);
    });

    test('a mixed-case username is found by its lowercase form', async () => {
        const mixed = `${PREFIX}${stamp}MiXeD`;
        await makeUser(mixed, email);

        const { code, stdout } = await runScript(['--username', mixed.toLowerCase()]);

        expect(code).toBe(0);
        expect(stdout).toContain(mixed);
        expect(stdout).toContain('1 account(s) matched');
    });

    test('an address with no account exits non-zero without touching anything', async () => {
        await makeUser(`${PREFIX}${stamp}a`, email);

        const { code } = await runScript(['--email', `${PREFIX}nobody${stamp}@lighterpack.com`, '--live']);

        expect(code).toBe(1);
        expect(await usernames(email)).toEqual([`${PREFIX}${stamp}a`]);
    });
});
