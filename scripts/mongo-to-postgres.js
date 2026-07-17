// Takes a json mongo export file and writes to the postgres database

import fs from 'fs';
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

const dryRun = true;
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

async function processLineByLine(dumpPath, userDates) {
    const stream = fs.createReadStream(dumpPath, {flags: 'r', encoding: 'utf-8'});
  
    const rl = readline.createInterface({
        input: stream,
        crlfDelay: Infinity
    });
  
    for await (const line of rl) {
        const user = JSON.parse(line);

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
            token: user.token,
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
}

processLineByLine(dumpPath, userDates).then(() => {
    console.log(i);
    console.log(errcount);
    console.log(unknownRegistrationCount);
    console.log(JSON.stringify(duplicateUsers));
    console.log(JSON.stringify(duplicateLists));
    console.log(`re-encode failures (stored raw): ${reencodeFailures.length}`);
    console.log(JSON.stringify(reencodeFailures));
    return knex.destroy();
});
