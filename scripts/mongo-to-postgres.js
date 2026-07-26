// Takes a json mongo export file and writes to the postgres database.
//
//   node scripts/mongo-to-postgres.js <users-dump.json> <user-dates.json> [--live]
//
// Dry run unless --live is passed: without it every record is read, parsed and
// re-encoded exactly as normal, but nothing is inserted. Registration dates come
// from each record's mongo ObjectId; <user-dates.json> supplies last_seen only.

import fs from 'fs';
import crypto from 'crypto';
import readline from 'readline';
import config from 'config';
import cloneDeep from 'lodash/cloneDeep.js';
import Knex from 'knex';
import { Library } from '../client/dataTypes.js';

const knex = Knex({
    client: 'pg',
    connection: cloneDeep(config.get('pgDatabase'))
});

const argv = process.argv.slice(2);
const flags = argv.filter((a) => a.startsWith('--'));
const args = argv.filter((a) => !a.startsWith('--'));
const unknownFlags = flags.filter((f) => f !== '--live');

if (args.length !== 2 || unknownFlags.length) {
    if (unknownFlags.length) console.error(`Unknown flag(s): ${unknownFlags.join(' ')}`);
    console.error('Usage: node scripts/mongo-to-postgres.js <users-dump.json> <user-dates.json> [--live]');
    process.exit(2);
}

// Defaults to a dry run. This writes to a live database, so the destructive
// direction must never be the one you get by forgetting a flag -- it used to be
// a hardcoded constant, which meant the armed state could be committed and then
// inherited by whoever ran it next. Matches --live on the fix-duplicate-* scripts.
const dryRun = flags.indexOf('--live') === -1;
const [dumpPath, userDatesFilePath] = args;

console.log(`Dry run: ${dryRun}`);
if (dryRun) console.log('No rows will be written. Re-run with --live to apply.');

const userDatesRaw = fs.readFileSync(userDatesFilePath)
const userDates = JSON.parse(userDatesRaw);

let i = 0;
let errcount = 0;
let unknownLastSeenCount = 0;
let clampedLastSeenCount = 0;
let oidRegistrationCount = 0;
let fileRegistrationCount = 0;
let fallbackRegistrationCount = 0;

// Last resort only -- reached when a record has neither a usable ObjectId nor a
// row in user-dates.json.
const FALLBACK_DATE = '2024-11-01T00:00:00.000Z';

// The first 4 bytes of a mongo ObjectId are the document's creation time, which
// for a user document is the moment they registered. Checked against the
// 296,399 registrations independently observed in the request logs: median
// difference 0.000 days, 99.76% within one day. That beats user-dates.json,
// which can only *infer* a date for anyone whose signup predates the surviving
// logs -- 1,667 users, off by an average of four years.
function registeredFromObjectId(user) {
    const oid = user._id && user._id.$oid;
    if (typeof oid !== 'string' || !/^[0-9a-f]{24}$/.test(oid)) return null;
    const seconds = parseInt(oid.slice(0, 8), 16);
    // LighterPack's first account is from 2013-09. A timestamp outside a sane
    // window means this is not a generated ObjectId, so fall back rather than
    // write a nonsense date.
    const earliest = Date.UTC(2013, 0, 1) / 1000;
    if (!Number.isFinite(seconds) || seconds < earliest) return null;
    const date = new Date(seconds * 1000);
    if (date.getTime() > Date.now()) return null;
    return date.toISOString();
}

const duplicateUsers = [];
const duplicateLists = [];
const reencodeFailures = [];
const splitRecords = [];
const unparseableRecords = [];

const tryParseUser = (text) => {
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
};

async function processLineByLine(dumpPath, userDates) {
    const stream = fs.createReadStream(dumpPath, {flags: 'r', encoding: 'utf-8'});
  
    const rl = readline.createInterface({
        input: stream,
        crlfDelay: Infinity
    });
  
    let pending = null;

    for await (const line of rl) {
        // 22 records in the 2026-07-14 dump contain a raw newline inside a
        // string -- mongo stored it unescaped, so mongoexport wrote the record
        // across several physical lines. Reading line-by-line and calling
        // JSON.parse directly throws on the first one (`theckeler`, ~4% in) and
        // kills the whole import. Accumulate until the record parses, joining
        // with an escaped newline because a literal one is not legal inside a
        // JSON string.
        let user = tryParseUser(line);

        if (user && pending !== null) {
            // The fragment we were accumulating never completed, so it is
            // genuinely corrupt rather than merely split. Record and move on.
            unparseableRecords.push(pending.slice(0, 200));
            pending = null;
        } else if (!user) {
            if (!line.trim() && pending === null) continue;
            pending = pending === null ? line : `${pending}\\n${line}`;
            user = tryParseUser(pending);
            if (!user) continue; // still incomplete -- keep accumulating
            splitRecords.push(user.username);
            pending = null;
        }

        let dateUserRegistered;
        let dateUserLastSeen;

        const username = user.username.trim();

        // Look up by the same trimmed key the guard tested. find-user-dates
        // trims before keying, so a user whose stored name has surrounding
        // whitespace passes the guard and then throws on the untrimmed read.
        const dates = userDates[username];

        // Registration: prefer the record's own ObjectId, which is exact, over
        // the log-derived guess.
        const oidRegistered = registeredFromObjectId(user);
        if (oidRegistered) {
            dateUserRegistered = oidRegistered;
            oidRegistrationCount++;
        } else if (dates) {
            dateUserRegistered = dates.registered;
            fileRegistrationCount++;
        } else {
            dateUserRegistered = FALLBACK_DATE;
            fallbackRegistrationCount++;
            console.log("no registration date available for: " + username);
        }

        // Last seen has to come from the logs -- the dump carries no
        // last-activity field. Anyone who registered after the final log rsync
        // has no row here, so fall back to their registration date: they
        // demonstrably existed at that moment, which beats stamping a
        // brand-new account with a constant from two years earlier.
        if (dates) {
            dateUserLastSeen = dates.lastSeen;
        } else {
            unknownLastSeenCount++;
            dateUserLastSeen = dateUserRegistered;
        }

        // last_seen before registered is self-contradictory. It happens when a
        // username was released and re-registered -- the log trail belongs to
        // the previous holder, the ObjectId to the current one.
        if (dateUserLastSeen < dateUserRegistered) {
            clampedLastSeenCount++;
            dateUserLastSeen = dateUserRegistered;
        }

        // Re-encode the library to the current format (0.4): the upgrade
        // chain runs once here instead of lazily in every client, and
        // save() drops the dead fields older formats accumulated. On
        // failure, store the raw library so the lazy client chain still
        // gets a chance at it.
        let libraryJson = user.library;
        let loadedLibrary = null;
        try {
            const library = new Library();
            library.load(user.library);
            libraryJson = library.save();
            loadedLibrary = library;
        } catch (err) {
            reencodeFailures.push(username);
            console.log(`re-encode failed, storing raw library for: ${username} - ${err.message}`);
        }

        const userBatch = {
            username: username,
            email: user.email,
            // One account in the export has no token. It is NOT NULL, so the
            // insert would fail and that user would be dropped. A fresh random
            // token costs nothing -- it just means no pre-existing session,
            // which is already true for an account that had no token.
            token: user.token || crypto.randomBytes(48).toString('hex'),
            password: user.password,
            library: libraryJson,
            // One higher than the mongo value: sessions survive the cutover
            // (token is copied), so this is what makes a tab from before the
            // migration fail its next save with "please refresh" instead of
            // writing a pre-0.4 library over the re-encoded one.
            sync_token: (user.syncToken || 0) + 1,
            registered: dateUserRegistered,
            last_seen: dateUserLastSeen
        };
        if (!dryRun) {
            try {
                await knex('users').insert(userBatch);
                try {
                    // Look up the trimmed name -- that is what was inserted
                    // above. Using user.username here misses any record with
                    // surrounding whitespace, and the undefined row then throws
                    // and silently costs that user all of their share links.
                    const userResult = await knex('users').select('user_id').where({ username });
                    const userId = userResult[0].user_id;

                    // No list rows for a re-encode failure: same as before,
                    // an unloadable library never got share links either.
                    const lists = loadedLibrary ? loadedLibrary.lists : [];
                    for (const list of lists) {
                        if (list.externalId) {
                            const listInsert = {
                                external_id: list.externalId,
                                user_id: userId
                            };
                            try {
                                await knex('list').insert(listInsert);
                            } catch(err) {
                                console.log("error inserting list:" + list.externalId + " for user: " +user.username);
                                duplicateLists.push(list.externalId);
                            }
                        }
                    }

                } catch (err) {
                    console.log(err);
                }
            } catch (err) {
                console.log("error inserting user:" + user.username)
                duplicateUsers.push(user.username);
                errcount++;
            }
        }
        
        i++;
        if (i % 1000 === 0) {
            console.log(i);
        }
    }

    if (pending !== null) {
        unparseableRecords.push(pending.slice(0, 200));
    }
}

processLineByLine(dumpPath, userDates).then(() => {
    console.log(i);
    console.log(errcount);
    console.log(`registration from ObjectId: ${oidRegistrationCount}`);
    console.log(`registration from user-dates.json: ${fileRegistrationCount}`);
    console.log(`registration with no source (SHOULD BE 0): ${fallbackRegistrationCount}`);
    console.log(`last-seen missing, fell back to registration: ${unknownLastSeenCount}`);
    console.log(`last-seen clamped forward to registration: ${clampedLastSeenCount}`);
    console.log(JSON.stringify(duplicateUsers));
    console.log(JSON.stringify(duplicateLists));
    console.log(`re-encode failures (stored raw): ${reencodeFailures.length}`);
    console.log(JSON.stringify(reencodeFailures));
    console.log(`records rejoined from multiple lines: ${splitRecords.length}`);
    console.log(JSON.stringify(splitRecords));
    console.log(`records that never parsed (SKIPPED -- investigate): ${unparseableRecords.length}`);
    console.log(JSON.stringify(unparseableRecords));
    // Repeated at the end because a long import scrolls the startup banner away,
    // and "it ran clean" reads identically to "it wrote nothing".
    if (dryRun) console.log('\nDRY RUN -- nothing was written. Re-run with --live to apply.');
    return knex.destroy();
}).catch((err) => {
    // Without this an import failure exits 0 with an unhandled rejection
    // warning, which is easy to mistake for success.
    console.error('IMPORT FAILED:', err);
    process.exitCode = 1;
    return knex.destroy();
});
