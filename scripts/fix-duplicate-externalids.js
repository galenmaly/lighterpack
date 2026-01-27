const fs = require('fs');
const readline = require('readline');
const dataTypes = require('../client/dataTypes.js');

const config = require('config');
const mongojs = require('mongojs');

const collections = ['users', 'libraries'];
const db = mongojs(config.get('databaseUrl'), collections);

const dumpPath = "C:\\dev\\_databases\\users.json";

const userDatesRaw = fs.readFileSync("C:\\dev\\logs\\user-dates.json")
const userDates = JSON.parse(userDatesRaw);

const dryRun = true;
console.log(`Dry run: ${dryRun}`);

async function processLineByLine(dumpPath) {
    const seenIds = {};
    const stream = fs.createReadStream(dumpPath, {flags: 'r', encoding: 'utf-8'});
    
    const rl = readline.createInterface({
        input: stream,
        crlfDelay: Infinity
    });

    let i = 0;
  
    for await (const line of rl) {
        const user = JSON.parse(line);
        const username = user.username.trim();

        const registered = userDates[username] ? userDates[username].registered : null;
        const lastSeen = userDates[username] ? userDates[username].lastSeen : null;

        const library = new dataTypes.Library();
        try {
            library.load(user.library);
            const idsForUser = [];

            if (user.externalIds) {
                user.externalIds.forEach((externalId) => {
                    idsForUser.push(externalId.trim());
                });
            }

            library.lists.forEach((list) => {
                if (list.externalId) {
                    let listExternalId = list.externalId.trim();
                    if (idsForUser.indexOf(listExternalId) === -1) {
                        idsForUser.push(listExternalId);
                    }
                }
            });

            idsForUser.forEach((externalId) => {
                if (!seenIds[externalId]) {
                    seenIds[externalId] = {
                        externalId,
                        users: []
                    };
                }
                seenIds[externalId].users.push({
                    _id: user._id,
                    username: user.username,
                    items: library.items.length,
                    registered,
                    lastSeen
                });
            });
            
            
        } catch(err) {
            //console.log("invalid library!")
            console.log(err)
        }
        i++;
        
        if (i % 1000 === 0) {
            console.log(i);
        }
    }
    return seenIds;
}


function getUserById(_id) {
    return new Promise((resolve, reject) => {
        db.users.find({"_id" :  ObjectId(_id.$oid)}, (err, users) => {
            if (err) {
                reject(err);
                return;
            }
            if (users.length === 1 ) {
                resolve(users[0]);
                return;
            }

            reject();
        });
    });
}


function getCanonicalUserIdForExternalId(externalId) {
    return new Promise((resolve, reject) => {
        db.users.find({ 'library.lists.externalId': id }, (err, users) => {
            if (err || !users.length) {
                return false;
            }

            resolve(users[0]._id.$oid);
        });
    });
}

function assignNewExternalId(externalId, userId) {
    return new Promise(async (resolve, reject) => {
        const user = await getUserById(userId);
        // search through both library and externalIds list
        //
        // db.users.save(user);
    });
}

function deleteUser(user) {
    return new Promise((resolve, reject) => {
        if (dryRun) {
            return resolve();
        }

        db.users.remove(user, true, (err) => {
            if (err) {
                return reject(err);
            }
            resolve();
        });
    })
}

async function fixExternalId(externalId, users) {
    const canonicalUserId = await getCanonicalUserIdForExternalId(externalId);

    return Promise.all(users.map(async (user) => {
        if (user._id.$oid === canonicalUserId) {
            return Promise.resolve();
        }
        
        return assignNewExternalId(externalId, user._id.$oid);
    })
}

processLineByLine(dumpPath, userDates).then((ids) => {
    const idsArray = Object.values(ids);

    const duplicateIds = idsArray.filter((id) => {
        return id.users.length > 1;
    });

    for (duplicateId of duplicateIds) {
        numNotDeletable = 0;

        for (idInstance of duplicateId.users) {
            if (idInstance.items > 15) {
                numNotDeletable++;
                idInstance.isDeletable = false;
            } else {
                idInstance.isDeletable = true;
                const user = await getUserById(idInstance._id)
                // await deleteUser(user);
            }
        }

        if (numNotDeletable > 1) {
            duplicateId.isResolvable = false;
        } else {
            duplicateId.isResolvable = true;
        }
    }

    const unresolveableDuplicateIds = duplicateIds.filter((id) => {
        return !id.isResolvable;
    });

    console.log(`Duplicate users: ${duplicateIds.length}`);
    console.log(`Unresolveable duplicate users: ${unresolveableDuplicateIds.length}`);
    console.log(JSON.stringify(unresolveableDuplicateIds));
});

