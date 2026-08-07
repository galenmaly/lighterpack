// Delete accounts on a user's behalf, for when they cannot practically do it
// themselves -- most often one person holding several accounts under one email
// address, each with its own forgotten password.
//
//   node scripts/delete-account.js --email someone@example.com
//   node scripts/delete-account.js --email someone@example.com --live
//   node scripts/delete-account.js --username bob --live
//   node scripts/delete-account.js --email someone@example.com --only bob,bob2 --live
//   node scripts/delete-account.js --restore logs/deleted-accounts/bob-1234.json --live
//
// Dry run unless --live is passed: it finds the accounts and prints what would
// go, but touches nothing. Matches --live on the fix-duplicate-* scripts.
//
// Runs the same deleteUserAccount() the user's own Delete Account button runs,
// so nothing is missed by hand -- the FK ordering, and the image directory
// whose name is a hash of the user_id rather than anything greppable.
//
// Every account is written to logs/deleted-accounts/ before it goes, so a
// mistake is recoverable with --restore. Those files hold the row verbatim,
// including the email and password hash: they are a backup, not an archive.
// Photos are not in them -- restoring brings back the account and its lists,
// not the images, which are deleted from disk.

import fs from 'node:fs';
import path from 'node:path';
import config from 'config';
import cloneDeep from 'lodash/cloneDeep.js';
import Knex from 'knex';
import { deleteUserAccount, closeAccountsDb } from '../server/accounts.js';
import { userImageLocation } from '../server/images.js';

const knex = Knex({
    client: 'pg',
    connection: cloneDeep(config.get('pgDatabase'))
});

const BACKUP_DIR = path.join(import.meta.dirname, '..', 'logs', 'deleted-accounts');

const argv = process.argv.slice(2);
const flag = (name) => {
    const i = argv.indexOf(`--${name}`);
    if (i > -1) return argv[i + 1];
    const inline = argv.find((a) => a.startsWith(`--${name}=`));
    return inline ? inline.split('=').slice(1).join('=') : undefined;
};

const dryRun = !argv.includes('--live');
const username = flag('username');
const email = flag('email');
const only = flag('only');
const restore = flag('restore');

/** yyyy-mm-dd from the pg driver's Date, or from an already-serialized string. */
function day(value) {
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().slice(0, 10);
}

/** One line per account, enough to be sure it is the right one before it goes. */
function describe(user, extras) {
    const items = Array.isArray(user.library?.items) ? user.library.items.length : '?';
    const lists = Array.isArray(user.library?.lists) ? user.library.lists.length : '?';
    return [
        `  ${user.username}  <${user.email}>`,
        `      registered ${day(user.registered)}`
            + `   last seen ${day(user.last_seen)}`
            + `   saves ${user.sync_token}`,
        `      ${items} items, ${lists} lists, ${extras.shareLinks} share links, ${extras.images} image files`,
    ].join('\n');
}

/** Files on disk for this user, counted without deleting anything. */
function countImages(userId) {
    const { dir } = userImageLocation(userId);
    return fs.existsSync(dir) ? fs.readdirSync(dir).length : 0;
}

async function restoreFromBackup(file) {
    const backup = JSON.parse(fs.readFileSync(file, 'utf8'));
    const { user, lists } = backup;

    const clash = await knex('users')
        .where({ user_id: user.user_id })
        .orWhere({ username: user.username })
        .first();
    if (clash) {
        console.error(`Cannot restore: ${clash.username} already exists (the username was re-registered, or this backup was already restored).`);
        process.exit(1);
    }

    console.log(`Restoring ${user.username} <${user.email}> and ${lists.length} share link(s) from ${file}`);
    console.log('Photos are not restored -- they were deleted from disk.');
    if (dryRun) {
        console.log('\nDry run. Re-run with --live to apply.');
        return;
    }

    await knex.transaction(async (trx) => {
        // The library column is json; knex wants it as text going in.
        await trx('users').insert({ ...user, library: JSON.stringify(user.library) });
        if (lists.length) await trx('list').insert(lists);
    });
    console.log(`Restored ${user.username}.`);
}

async function main() {
    if (restore) return restoreFromBackup(restore);

    if (!username && !email) {
        console.error('Usage: node scripts/delete-account.js (--username <name> | --email <addr>) [--only a,b] [--live]');
        console.error('       node scripts/delete-account.js --restore <backup.json> [--live]');
        process.exit(2);
    }

    // Email is deliberately not unique (see db/01_users.sql) and thousands of
    // addresses are shared by several accounts -- which is the case this script
    // exists for, so an email match takes every account holding it.
    // Both matched case-insensitively. Usernames are not uniformly lowercase --
    // see scripts/fix-uppercase-users.js -- and "no account matches" for an
    // account that plainly exists is the worst failure this script could have.
    // If case-variants both exist, they are both listed and --only picks.
    const matches = username
        ? await knex('users').whereRaw('lower(username) = ?', [String(username).toLowerCase().trim()])
        : await knex('users').whereRaw('lower(email) = ?', [String(email).toLowerCase().trim()]);

    if (!matches.length) {
        console.error(`No account matches ${username ? `username ${username}` : `email ${email}`}.`);
        process.exit(1);
    }

    const wanted = only ? new Set(only.split(',').map((n) => n.trim().toLowerCase())) : null;
    const targets = wanted ? matches.filter((u) => wanted.has(u.username.toLowerCase())) : matches;

    if (wanted) {
        const missing = [...wanted].filter((n) => !matches.some((u) => u.username.toLowerCase() === n));
        if (missing.length) {
            console.error(`--only names an account that does not match: ${missing.join(', ')}`);
            process.exit(1);
        }
    }

    const moderators = config.has('moderators') ? config.get('moderators') : [];
    const skipped = matches.length - targets.length;

    console.log(`Dry run: ${dryRun}`);
    console.log(`\n${matches.length} account(s) matched${skipped ? `, ${skipped} excluded by --only` : ''}. To delete:\n`);

    const plans = [];
    for (const user of targets) {
        const shareLinks = Number((await knex('list').where({ user_id: user.user_id }).count({ n: '*' }))[0].n);
        const images = countImages(user.user_id);
        plans.push({ user, shareLinks, images });
        console.log(describe(user, { shareLinks, images }));
        if (moderators.includes(user.username)) {
            console.log('      *** THIS IS A MODERATOR ACCOUNT ***');
        }
        console.log('');
    }

    if (dryRun) {
        console.log('Nothing was deleted. Re-run with --live to apply.');
        return;
    }

    fs.mkdirSync(BACKUP_DIR, { recursive: true });

    for (const { user, shareLinks, images } of plans) {
        const lists = await knex('list').where({ user_id: user.user_id });
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(BACKUP_DIR, `${user.username}-${stamp}.json`);
        // Written and flushed before the delete, so the backup cannot be the
        // thing that is missing when you need it.
        fs.writeFileSync(backupPath, JSON.stringify({ deletedAt: new Date().toISOString(), user, lists }, null, 2));

        const { removedImages, imageError } = await deleteUserAccount(user);

        // Same shape as the app's logger, so an operator deletion is greppable
        // alongside the user-initiated ones.
        console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            message: 'OPERATOR account delete',
            username: user.username,
            email: user.email,
            shareLinks,
            imagesExpected: images,
            removedImages,
            backup: path.relative(process.cwd(), backupPath),
            ...(imageError ? { err: { message: imageError.message } } : {}),
        }));
        if (imageError) console.error(`  image cleanup failed for ${user.username}: ${imageError.message}`);
    }

    console.log(`\nDeleted ${plans.length} account(s). Backups in ${path.relative(process.cwd(), BACKUP_DIR)}/`);
    console.log('Restore one with: node scripts/delete-account.js --restore <file> --live');
}

try {
    await main();
} finally {
    // Both pools, or the process sits idle instead of exiting: server/accounts.js
    // opens its own for the shared delete path.
    await knex.destroy();
    await closeAccountsDb();
}
