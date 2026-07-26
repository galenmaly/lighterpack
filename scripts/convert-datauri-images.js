// Convert data-URI images embedded in library JSON into hosted webp files.
//
// ~1.4% of users have pasted `data:image/...;base64,` URIs into the image-URL
// field (mostly Google Images thumbnails). Those blobs live inside the library
// JSON, so they're re-sent on every save and inflate rendered share pages.
// This sweep decodes each one, runs it through the same cwebp pipeline as
// uploads (server/images.js), and rewrites imageUrl to /userimages/....
//
// Usage:
//   node scripts/convert-datauri-images.js               dry run (no writes)
//   node scripts/convert-datauri-images.js --live        convert and rewrite
//   node scripts/convert-datauri-images.js --live --limit 100
//   node scripts/convert-datauri-images.js --live --user someusername
//
// Run on the server that owns public/userimages (requires cwebp). Safe to run
// while the site is live and safe to interrupt: each user is one guarded
// UPDATE, and the sweep deliberately does NOT bump sync_token — an active
// session's next save simply overwrites the rewrite (their files stay on
// disk), and a rerun converges. Users whose sync_token moved between our read
// and write are skipped and picked up on the next run.

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import config from 'config';
import Knex from 'knex';
import cloneDeep from 'lodash/cloneDeep.js';

import { sniffImage, storeImage } from '../server/images.js';

const BATCH_SIZE = 50;

/** Decode a base64 data URI into a Buffer, or null if it isn't one. */
function parseDataUri(url) {
    const match = /^data:image\/[a-z0-9+.-]+;base64,(.+)$/i.exec(url);
    if (!match) return null;
    const buf = Buffer.from(match[1], 'base64');
    return buf.length > 0 ? buf : null;
}

/**
 * Rewrite every convertible data-URI imageUrl in a library (mutates it).
 * convertFn(buf, width) -> hosted url; pass null for a dry run (counts only,
 * no mutation). Returns { converted, failed, unsupported, bytesBefore, bytesAfter }.
 */
async function sweepLibraryImages(library, convertFn) {
    const stats = { converted: 0, failed: 0, unsupported: 0, bytesBefore: 0, bytesAfter: 0 };
    for (const item of library.items || []) {
        if (typeof item.imageUrl !== 'string' || !item.imageUrl.startsWith('data:image/')) continue;

        const buf = parseDataUri(item.imageUrl);
        const sniffed = buf && sniffImage(buf);
        if (!sniffed) {
            // Not decodable or not jpeg/png/webp (avif, gif, svg, garbage).
            stats.unsupported += 1;
            continue;
        }

        if (!convertFn) {
            stats.converted += 1;
            stats.bytesBefore += item.imageUrl.length;
            stats.bytesAfter += '/userimages/xx/0123456789abcdef/0123456789abcdef.webp'.length;
            continue;
        }

        try {
            const newUrl = await convertFn(buf, sniffed.width);
            stats.bytesBefore += item.imageUrl.length;
            stats.bytesAfter += newUrl.length;
            item.imageUrl = newUrl;
            stats.converted += 1;
        } catch (err) {
            // cwebp couldn't decode it (truncated/corrupt image); leave as-is.
            stats.failed += 1;
        }
    }
    return stats;
}

/**
 * Build the converter for one user: writes the buffer to a temp file and runs
 * it through the upload pipeline, storing the result among that user's images.
 */
function convertBufferFor(userId) {
    return async function convertBuffer(buf, width) {
        const tmpPath = path.join(os.tmpdir(), `lp-datauri-${process.pid}-${crypto.randomBytes(6).toString('hex')}`);
        fs.writeFileSync(tmpPath, buf);
        try {
            const { imageUrl } = await storeImage(tmpPath, buf, width, userId);
            return imageUrl;
        } finally {
            fs.rmSync(tmpPath, { force: true });
        }
    };
}

async function main() {
    const args = process.argv.slice(2);
    const live = args.includes('--live');
    const userIdx = args.indexOf('--user');
    const onlyUser = userIdx === -1 ? null : args[userIdx + 1];
    const limitIdx = args.indexOf('--limit');
    const maxUsers = limitIdx === -1 ? Infinity : parseInt(args[limitIdx + 1], 10);
    if (limitIdx !== -1 && !(maxUsers > 0)) {
        console.error('--limit requires a positive number');
        process.exit(1);
    }

    const knex = Knex({
        client: 'pg',
        connection: cloneDeep(config.get('pgDatabase')),
    });

    console.log(live ? 'LIVE RUN — converting images and rewriting libraries' : 'Dry run — no files written, no rows updated (--live to apply)');

    const totals = { matched: 0, usersRewritten: 0, raced: 0, converted: 0, failed: 0, unsupported: 0, bytesBefore: 0, bytesAfter: 0 };
    let lastId = null;
    let done = false;

    while (!done) {
        let query = knex('users')
            .select('user_id', 'username', 'library', 'sync_token')
            .whereRaw("library::text like '%data:image/%'")
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
            const stats = await sweepLibraryImages(library, live ? convertBufferFor(row.user_id) : null);
            for (const key of ['converted', 'failed', 'unsupported', 'bytesBefore', 'bytesAfter']) totals[key] += stats[key];
            if (stats.converted === 0) continue;

            if (live) {
                // Same lost-update guard as saveLibrary, but without bumping
                // sync_token: open sessions keep saving normally instead of
                // being told to refresh, at worst undoing this rewrite until
                // the next run.
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

            if (totals.usersRewritten >= maxUsers) { done = true; break; }
        }

        if (totals.matched % 500 < BATCH_SIZE) {
            console.log(`...${totals.matched} users scanned, ${totals.converted} images ${live ? 'converted' : 'convertible'}`);
        }
    }

    await knex.destroy();

    const mb = (n) => (n / 1048576).toFixed(1);
    const line = (label, value) => console.log(`${label.padEnd(22)}${value}`);
    console.log('');
    line('users matched:', totals.matched);
    line(`users ${live ? 'rewritten' : 'to rewrite'}:`, `${totals.usersRewritten}${totals.raced ? ` (+${totals.raced} skipped: concurrent save)` : ''}`);
    line(`images ${live ? 'converted' : 'convertible'}:`, totals.converted);
    if (totals.failed) line('images failed:', `${totals.failed} (cwebp could not decode; left in place)`);
    if (totals.unsupported) line('images unsupported:', `${totals.unsupported} (not jpeg/png/webp; left in place)`);
    line('library JSON shrunk:', `${mb(totals.bytesBefore)}MB -> ${mb(totals.bytesAfter)}MB${live ? '' : ' (estimated)'}`);
    if (!live) console.log('\nRerun with --live to apply.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch((err) => {
        console.error(err);
        process.exit(1);
    });
}

export { parseDataUri, sweepLibraryImages };
