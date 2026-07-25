// Takes a json mongo export file and writes to the postgres database

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

if (process.argv.length !== 4) {
    console.error('Expected log directory as argument');
    process.exit(1);
}

const dryRun = false;
console.log(`Dry run: ${dryRun}`);

const dumpPath = process.argv[2];
const userDatesFilePath = process.argv[3];

const userDatesRaw = fs.readFileSync(userDatesFilePath)
const userDates = JSON.parse(userDatesRaw);

let i = 0;
let errcount = 0;
let unknownRegistrationCount = 0;

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

        if (userDates[username]) {
            dateUserRegistered = userDates[user.username].registered;
            dateUserLastSeen = userDates[user.username].lastSeen;
        } else {
            unknownRegistrationCount++
            console.log("unknown registration date for: " +  username);
            dateUserRegistered = "2024-11-01T00:00:00.000Z"
            dateUserLastSeen = "2024-11-01T00:00:00.000Z"
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
                    const userResult = await knex('users').select('user_id').where({username: user.username});
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
    console.log(unknownRegistrationCount);
    console.log(JSON.stringify(duplicateUsers));
    console.log(JSON.stringify(duplicateLists));
    console.log(`re-encode failures (stored raw): ${reencodeFailures.length}`);
    console.log(JSON.stringify(reencodeFailures));
    console.log(`records rejoined from multiple lines: ${splitRecords.length}`);
    console.log(JSON.stringify(splitRecords));
    console.log(`records that never parsed (SKIPPED -- investigate): ${unparseableRecords.length}`);
    console.log(JSON.stringify(unparseableRecords));
    return knex.destroy();
}).catch((err) => {
    // Without this an import failure exits 0 with an unhandled rejection
    // warning, which is easy to mistake for success.
    console.error('IMPORT FAILED:', err);
    process.exitCode = 1;
    return knex.destroy();
});
