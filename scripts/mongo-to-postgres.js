// Takes a json mongo export file and writes to the postgres database

const config = require('config');
const fs = require('fs');
const readline = require('readline');
const dataTypes = require('../client/dataTypes.js');
const knex = require('knex')({
    client: 'pg',
    connection: config.util.cloneDeep(config.get('pgDatabase'))
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

        const userBatch = {
            username: username,
            email: user.email,
            token: user.token,
            password: user.password,
            library: user.library,
            sync_token: user.syncToken,
            registered: dateUserRegistered,
            last_seen: dateUserLastSeen
        };
        if (!dryRun) {
            try {
                await knex('users').insert(userBatch);
                const library = new dataTypes.Library();
                try {
                    library.load(user.library);
    
                    const userResult = await knex('users').select('user_id').where({username: user.username});
                    const userId = userResult[0].user_id;
                    
                    library.lists.forEach(async (list) => {
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
                    });
    
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
});
