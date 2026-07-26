// Trickle-mirror legacy imgur images into hosted webp files.
//
// item.image holds a 7-char imgur id from the old upload flow (~270k unique
// ids in production). Imgur already blocks our uploads and purges inactive
// images, so this rescues what still exists. Two independent phases:
//
//   FETCH — download each id's 640px variant (what the site serves today),
//   convert through the upload pipeline (server/images.js) into a staging
//   directory, and record the outcome in a ledger file. Needs no database when
//   run from a dump, so it can run from any machine imgur doesn't block, days
//   before the migration:
//     node scripts/mirror-imgur-images.js --fetch --dump logs/users-2026-07-14.json.gz
//     node scripts/mirror-imgur-images.js --fetch            (ids from postgres)
//   The ledger and the staging directory must both ship to the server. Resume
//   is automatic: ids already in the ledger are skipped, transient errors are
//   retried on the next run. Throttled via --delay ms (default 1000); --limit N
//   caps new fetches per run.
//
//   REWRITE — post-migration, on the server: give each user their own copy of
//   the staged files and point their items at them (sets imageUrl, clears the
//   imgur id) for every id the ledger has:
//     node scripts/mirror-imgur-images.js --rewrite           (dry run)
//     node scripts/mirror-imgur-images.js --rewrite --live
//   Staging exists because images are stored per user (see server/images.js):
//   one fetch per imgur id, then a copy for each user that references it — 84
//   of production's 270k ids are held by more than one user.
//   Items whose image is dead at imgur (removed/notfound) are left alone by
//   default so nothing is destroyed; add --clear-dead to blank those refs.
//   Same safety story as convert-datauri-images.js: guarded per-user updates,
//   sync_token untouched, idempotent, safe to interrupt.

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { pathToFileURL } from 'node:url';
import zlib from 'node:zlib';

import config from 'config';
import Knex from 'knex';
import cloneDeep from 'lodash/cloneDeep.js';

import { sniffImage, storeImageFiles, adoptImage, userImageLocation } from '../server/images.js';

const BATCH_SIZE = 50;
// Fetched images land here, converted but unowned; rewrite copies each one
// into the directory of every user whose library references it.
const DEFAULT_STAGING_DIR = 'logs/imgur-mirror-staging';
const LEDGER_SAVE_EVERY = 200;
const IMGUR_ID_RE = /^[A-Za-z0-9]{5,8}$/;
// Deleted images 302 to this placeholder instead of 404ing.
const REMOVED_URL = 'removed.png';
const REMOVED_SHA256 = '9b5936f4006146e4e1e9025b474c02863c0b5614132ad40db4b925a10e8bfbb9';

/** Imgur ids referenced by a library's items. */
function harvestImgurIds(library) {
    const ids = [];
    for (const item of library.items || []) {
        if (typeof item.image === 'string' && IMGUR_ID_RE.test(item.image)) ids.push(item.image);
    }
    return ids;
}

/** True when an imgur response is the deleted-image placeholder. */
function isRemovedImage(finalUrl, buf) {
    if (finalUrl && finalUrl.includes(REMOVED_URL)) return true;
    return crypto.createHash('sha256').update(buf).digest('hex') === REMOVED_SHA256;
}

/**
 * Point items at mirrored files using the ledger (mutates the library).
 * `adopt(id)` returns the URL for this user's own copy of a staged image;
 * tests pass a stub, so no files are touched unless a real one is supplied.
 * Returns { rewritten, dead, deadCleared, unfetched }.
 */
function rewriteLibraryImages(library, ledgerImages, { clearDead = false, adopt = null } = {}) {
    const stats = { rewritten: 0, dead: 0, deadCleared: 0, unfetched: 0 };
    for (const item of library.items || []) {
        if (typeof item.image !== 'string' || !IMGUR_ID_RE.test(item.image)) continue;
        const entry = ledgerImages[item.image];
        if (!entry) {
            stats.unfetched += 1;
        } else if (entry.status === 'ok') {
            item.imageUrl = adopt ? adopt(entry.id) : entry.id;
            item.image = '';
            stats.rewritten += 1;
        } else {
            stats.dead += 1;
            if (clearDead) {
                item.image = '';
                stats.deadCleared += 1;
            }
        }
    }
    return stats;
}

function loadLedger(ledgerPath) {
    if (!fs.existsSync(ledgerPath)) return { version: 1, images: {} };
    return JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
}

function saveLedger(ledgerPath, ledger) {
    fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
    const tmpPath = `${ledgerPath}.tmp-${process.pid}`;
    fs.writeFileSync(tmpPath, JSON.stringify(ledger));
    fs.renameSync(tmpPath, ledgerPath);
}

function makeKnex() {
    return Knex({
        client: 'pg',
        connection: cloneDeep(config.get('pgDatabase')),
    });
}

/** Collect unique imgur ids from a mongoexport dump (.json or .json.gz). */
async function idsFromDump(dumpPath) {
    // Regex over raw lines — no JSON parsing, so records split across lines
    // by stray newlines in content are harmless (worst case an id at the seam
    // is missed and caught later by a DB-sourced fetch run).
    let stream = fs.createReadStream(dumpPath);
    if (dumpPath.endsWith('.gz')) stream = stream.pipe(zlib.createGunzip());
    const ids = new Set();
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    for await (const line of rl) {
        for (const match of line.matchAll(/"image"\s*:\s*"([A-Za-z0-9]{5,8})"/g)) ids.add(match[1]);
    }
    return ids;
}

/** Collect unique imgur ids from the postgres users table. */
async function idsFromDatabase(knex) {
    const ids = new Set();
    let lastId = null;
    for (;;) {
        let query = knex('users')
            .select('user_id', 'library')
            .whereRaw('library::text ~ \'"image"\\s*:\\s*"[A-Za-z0-9]\'')
            .orderBy('user_id')
            .limit(BATCH_SIZE);
        if (lastId) query = query.andWhere('user_id', '>', lastId);
        const rows = await query;
        if (rows.length === 0) break;
        lastId = rows[rows.length - 1].user_id;
        for (const row of rows) {
            const library = typeof row.library === 'string' ? JSON.parse(row.library) : row.library;
            for (const id of harvestImgurIds(library)) ids.add(id);
        }
    }
    return ids;
}

async function fetchImgurImage(id, stagingDir) {
    const response = await fetch(`https://i.imgur.com/${id}l.jpg`, {
        redirect: 'follow',
        signal: AbortSignal.timeout(30000),
        headers: { 'User-Agent': 'lighterpack-image-mirror (migrating our users\' images off imgur)' },
    });
    if (response.status === 404 || response.status === 410) {
        return { status: 'notfound' };
    }
    if (!response.ok) {
        const err = new Error(`imgur responded ${response.status} for ${id}`);
        err.transient = true;
        throw err;
    }
    const buf = Buffer.from(await response.arrayBuffer());
    if (isRemovedImage(response.url, buf)) return { status: 'removed' };
    const sniffed = sniffImage(buf);
    if (!sniffed) return { status: 'unsupported', contentType: response.headers.get('content-type') || '' };

    const tmpPath = path.join(os.tmpdir(), `lp-imgur-${process.pid}-${crypto.randomBytes(6).toString('hex')}`);
    fs.writeFileSync(tmpPath, buf);
    try {
        const storedId = await storeImageFiles(tmpPath, buf, sniffed.width, stagingDir);
        return { status: 'ok', id: storedId };
    } finally {
        fs.rmSync(tmpPath, { force: true });
    }
}

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

async function runFetch({ dumpPath, ledgerPath, delayMs, maxFetches, stagingDir }) {
    const ledger = loadLedger(ledgerPath);
    let knex = null;
    let ids;
    if (dumpPath) {
        console.log(`harvesting imgur ids from ${dumpPath}...`);
        ids = await idsFromDump(dumpPath);
    } else {
        console.log('harvesting imgur ids from postgres...');
        knex = makeKnex();
        ids = await idsFromDatabase(knex);
        await knex.destroy();
    }
    const pending = [...ids].filter((id) => !ledger.images[id]);
    console.log(`${ids.size} unique ids, ${ids.size - pending.length} already in ledger, ${pending.length} to fetch`);
    if (maxFetches < pending.length) console.log(`fetching at most ${maxFetches} this run (--limit)`);

    const counts = { ok: 0, removed: 0, notfound: 0, unsupported: 0, errors: 0 };
    let fetched = 0;
    let sinceSave = 0;
    let consecutiveErrors = 0;
    let interrupted = false;
    const onSigint = () => { interrupted = true; console.log('\ninterrupted — saving ledger...'); };
    process.once('SIGINT', onSigint);

    for (const id of pending) {
        if (interrupted || fetched >= maxFetches) break;
        try {
            const outcome = await fetchImgurImage(id, stagingDir);
            ledger.images[id] = outcome;
            counts[outcome.status] += 1;
            consecutiveErrors = 0;
            sinceSave += 1;
        } catch (err) {
            // Not recorded in the ledger, so the next run retries it.
            counts.errors += 1;
            consecutiveErrors += 1;
            console.log(`error fetching ${id}: ${err.message}`);
            if (err.transient) await sleep(30000);
            if (consecutiveErrors >= 8) {
                console.log('8 consecutive failures — imgur may be blocking or down, stopping this run');
                break;
            }
        }
        fetched += 1;
        if (sinceSave >= LEDGER_SAVE_EVERY) {
            saveLedger(ledgerPath, ledger);
            sinceSave = 0;
        }
        if (fetched % 100 === 0) {
            console.log(`...${fetched}/${Math.min(pending.length, maxFetches)} this run (${counts.ok} ok, ${counts.removed + counts.notfound} dead)`);
        }
        await sleep(delayMs);
    }
    process.removeListener('SIGINT', onSigint);

    saveLedger(ledgerPath, ledger);
    const total = Object.keys(ledger.images).length;
    console.log('');
    console.log(`this run:      ${counts.ok} mirrored, ${counts.removed} removed, ${counts.notfound} not found, ${counts.unsupported} unsupported, ${counts.errors} errors`);
    console.log(`ledger:        ${total}/${ids.size} ids resolved (${ledgerPath})`);
    console.log(`staged files:  ${stagingDir} — ship this with the ledger`);
    if (total < ids.size) console.log(`remaining:     ${ids.size - total} — rerun to continue`);
    if (interrupted) process.exit(130);
}

async function runRewrite({ ledgerPath, live, clearDead, onlyUser, stagingDir }) {
    const ledger = loadLedger(ledgerPath);
    const known = Object.keys(ledger.images).length;
    if (known === 0) {
        console.error(`ledger ${ledgerPath} is empty or missing — run --fetch first`);
        process.exit(1);
    }
    if (!fs.existsSync(stagingDir)) {
        console.error(`staging directory ${stagingDir} is missing — it holds the fetched files and must ship with the ledger`);
        process.exit(1);
    }
    console.log(live ? 'LIVE RUN — rewriting libraries' : 'Dry run — no rows updated (--live to apply)');
    console.log(`ledger: ${known} resolved ids (${ledgerPath})`);
    console.log(`staged: ${stagingDir}`);

    const knex = makeKnex();
    const totals = { matched: 0, usersRewritten: 0, raced: 0, rewritten: 0, dead: 0, deadCleared: 0, unfetched: 0 };
    let lastId = null;

    for (;;) {
        let query = knex('users')
            .select('user_id', 'username', 'library', 'sync_token')
            .whereRaw('library::text ~ \'"image"\\s*:\\s*"[A-Za-z0-9]\'')
            .orderBy('user_id')
            .limit(BATCH_SIZE);
        if (lastId) query = query.andWhere('user_id', '>', lastId);
        if (onlyUser) query = query.andWhere({ username: onlyUser });
        const rows = await query;
        if (rows.length === 0) break;
        lastId = rows[rows.length - 1].user_id;

        for (const row of rows) {
            totals.matched += 1;
            const library = typeof row.library === 'string' ? JSON.parse(row.library) : row.library;
            // Each user gets their own copy of the staged file. A dry run works
            // out the same URL without writing anything. On a lost update the
            // copy is left behind and reused when the next run retries the row.
            const adopt = live
                ? (id) => adoptImage(stagingDir, id, row.user_id)
                : (id) => `${userImageLocation(row.user_id).urlPath}/${id}.webp`;
            const stats = rewriteLibraryImages(library, ledger.images, { clearDead, adopt });
            for (const key of ['rewritten', 'dead', 'deadCleared', 'unfetched']) totals[key] += stats[key];
            if (stats.rewritten === 0 && stats.deadCleared === 0) continue;

            if (live) {
                // Same lost-update guard as saveLibrary, without bumping
                // sync_token (see convert-datauri-images.js).
                const updated = await knex('users')
                    .where({ user_id: row.user_id, sync_token: row.sync_token })
                    .update({ library: JSON.stringify(library) });
                if (updated) {
                    totals.usersRewritten += 1;
                } else {
                    totals.raced += 1;
                    console.log(`skipped ${row.username}: concurrent save, will retry on next run`);
                }
            } else {
                totals.usersRewritten += 1;
            }
        }
        if (totals.matched % 1000 < BATCH_SIZE) {
            console.log(`...${totals.matched} users scanned, ${totals.rewritten} items ${live ? 'rewritten' : 'rewritable'}`);
        }
    }
    await knex.destroy();

    const line = (label, value) => console.log(`${label.padEnd(22)}${value}`);
    console.log('');
    line('users matched:', totals.matched);
    line(`users ${live ? 'rewritten' : 'to rewrite'}:`, `${totals.usersRewritten}${totals.raced ? ` (+${totals.raced} skipped: concurrent save)` : ''}`);
    line(`items ${live ? 'rewritten' : 'rewritable'}:`, totals.rewritten);
    line('items dead at imgur:', `${totals.dead}${clearDead ? ` (${totals.deadCleared} cleared)` : ' (left in place; --clear-dead to blank them)'}`);
    if (totals.unfetched) line('items not in ledger:', `${totals.unfetched} (rerun --fetch to resolve them)`);
    if (!live) console.log('\nRerun with --live to apply.');
}

async function main() {
    const args = process.argv.slice(2);
    const flagValue = (name) => {
        const idx = args.indexOf(name);
        return idx === -1 ? null : args[idx + 1];
    };
    const mode = args.includes('--fetch') ? 'fetch' : (args.includes('--rewrite') ? 'rewrite' : null);
    if (!mode) {
        console.error('usage: mirror-imgur-images.js --fetch [--dump file.json[.gz]] [--delay ms] [--limit n] [--ledger file] [--staging dir]');
        console.error('       mirror-imgur-images.js --rewrite [--live] [--clear-dead] [--user name] [--ledger file] [--staging dir]');
        process.exit(1);
    }
    const ledgerPath = flagValue('--ledger') || 'logs/imgur-mirror-ledger.json';
    const stagingDir = flagValue('--staging') || DEFAULT_STAGING_DIR;

    if (mode === 'fetch') {
        const delayMs = flagValue('--delay') ? parseInt(flagValue('--delay'), 10) : 1000;
        const maxFetches = flagValue('--limit') ? parseInt(flagValue('--limit'), 10) : Infinity;
        if (!(delayMs >= 0) || !(maxFetches > 0)) {
            console.error('--delay must be >= 0 and --limit must be positive');
            process.exit(1);
        }
        await runFetch({ dumpPath: flagValue('--dump'), ledgerPath, delayMs, maxFetches, stagingDir });
    } else {
        await runRewrite({
            ledgerPath,
            live: args.includes('--live'),
            clearDead: args.includes('--clear-dead'),
            onlyUser: flagValue('--user'),
            stagingDir,
        });
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch((err) => {
        console.error(err);
        process.exit(1);
    });
}

export { harvestImgurIds, isRemovedImage, rewriteLibraryImages, IMGUR_ID_RE };
