// A few duplicate users with the same username got into the mongo database
// In preparation for the postgres migration we need to resolve them
// Delete the duplicates that are essentially empty
// And for the rest, rename the one that has fewer items
// Email the user about the change if they've logged in in the last couple years.

const fs = require('fs');
const readline = require('readline');
const dataTypes = require('../client/dataTypes.js');
const ObjectId = require('mongodb').ObjectId; 

const config = require('config');
const mongojs = require('mongojs');

const collections = ['users', 'libraries'];
const db = mongojs(config.get('databaseUrl'), collections);

const dryRun = false;

async function sendMail({ from, to, replyTo, subject, text }) {
    const apiKey = config.get('mailgunAPIKey');
    const domain = config.get('mailgunDomain');
    const body = new URLSearchParams({ from, to, subject, text, 'h:Reply-To': replyTo });
    const response = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
        method: 'POST',
        headers: { Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}` },
        body,
    });
    if (!response.ok) throw new Error(`Mailgun error: ${response.status} ${await response.text()}`);
}
console.log(`Dry run: ${dryRun}`);

const dumpPath = "C:\\dev\\_databases\\users.json";

const userDatesRaw = fs.readFileSync("C:\\dev\\logs\\user-dates.json")
const userDates = JSON.parse(userDatesRaw);

const autoFixableMessage = "Hello ${originalUsername},\n\nWhile performing a system update we noticed you had two users registered with the same username due to a bug. We apologize for any inconvenience or frustration this may have caused in the past. One of your users has been renamed and your two users are now ${originalUsername} and ${newUsername}. \n\nYou may have to reset your password to be able log in again which can be done at https://lighterpack.com/forgot-password \n\nApologies for any inconvenience, and if you have any isssues please reply to this email with details. \n\nThanks! \n\nThe LighterPack team";

async function processLineByLine(dumpPath, userDates) {
    const seenUsers = {};
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

            if (!seenUsers[username]) {
                seenUsers[username] = {
                    username,
                    ids: [],
                    registered: registered,
                    lastSeen: lastSeen
                };
            }
            seenUsers[username].ids.push({
                _id: user._id,
                items: library.items.length,
                externalIds: user.externalIds ? user.externalIds : [],
                email: user.email
            })
        } catch(err) {
            console.log(err)
        }
        i++;
        
        if (i % 1000 === 0) {
            console.log(i);
        }
    }
    console.log("done processlinebyline")
    return seenUsers;
}

function renameUser(user, newUsername) {
    return new Promise((resolve, reject) => {
        user.username = newUsername;
        if (!dryRun) {
            db.users.save(user);
        }
        resolve();
    });
}

function findNewUsername(originalUsername, suffix = 0) {
    return new Promise((resolve, reject) => {
        let newUsername;
        if (!suffix) {
            newUsername = originalUsername;
        } else {
            newUsername = originalUsername + String(suffix);
        }
        db.users.find({ username: newUsername }, (err, existingUsers) => {
            if (err) {
                reject(err);
                return;
            }
            if (existingUsers.length) {
                resolve(findNewUsername(originalUsername, suffix + 1));
                return;
            }

            resolve(newUsername);
        });
    });
}

async function messageUser(user, originalUsername, messageTemplate) {
    const newUsername = user.username;
    let message = messageTemplate.replace("${originalUsername}", originalUsername);
    message = message.replace("${originalUsername}", originalUsername);
    message = message.replace("${newUsername}", newUsername);

    const mailOptions = {
        from: 'LighterPack <info@mg.lighterpack.com>',
        to: user.email,
        replyTo: 'LighterPack <info@lighterpack.com>',
        subject: 'LighterPack account update',
        text: message,
    };

    if (dryRun) {
        console.log(mailOptions);
        return;
    }

    await sendMail(mailOptions);
}

function fixUser(user, messageTemplate, shouldSendMessage) {
    return new Promise((resolve, reject) => {
        const originalUsername = user.username;
        console.log("----")
        console.log(originalUsername)
        findNewUsername(user.username.trim())
            .then((newUsername) => {
                return renameUser(user, newUsername);
            })
            .then(() => {
            // uncomment me
            /*if (shouldSendMessage) { 
                return messageUser(user, originalUsername, messageTemplate);
            }*/
                return Promise.resolve();
            })
            .then(() => {
                console.log(originalUsername);
                resolve();
            })
            .catch(reject);
    });
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

processLineByLine(dumpPath, userDates).then(async (users) => {
    const usersArray = Object.values(users);

    const duplicateUsers = usersArray.filter((user) => {
        return user.ids.length > 1;
    });
    console.log("0")
    console.log(duplicateUsers)

    for (duplicateUser of duplicateUsers) {
        console.log("01")
        console.log(duplicateUser)
        let numNotDeletable = 0;
        let areEmailsAllSame = true;
        let firstEmail = null;

        duplicateUser.ids = duplicateUser.ids.sort((a,b) => {
            return a.items > b.items ? -1 : 1;
        });

        for (userInstance of duplicateUser.ids) {
            if (userInstance.items > 10) {
                numNotDeletable++;
                userInstance.isDeletable = false;
            } else {
                userInstance.isDeletable = true;
            }

            if (userInstance.isDeletable) {
                try {
                    const user = await getUserById(userInstance._id);
                    await deleteUser(user);
                } catch(err) {
                    console.log("error deleting user:")
                    console.log(err)
                    console.log(userInstance)
                }
            } else {
                if (!firstEmail) {
                    firstEmail = userInstance.email;
                }

                if (userInstance.email !== firstEmail) {
                    areEmailsAllSame = false;
                }
            }
        }

        if (numNotDeletable > 1) {
            duplicateUser.isResolvable = false;
        } else {
            duplicateUser.isResolvable = true;
        }
        duplicateUser.areEmailsAllSame = areEmailsAllSame;
    }

    console.log("1")

    const unresolveableDuplicateUsers = duplicateUsers.filter((duplicateUser) => {
        return !duplicateUser.isResolvable;
    });

    console.log("2")

    for (let duplicateUser of unresolveableDuplicateUsers) {
        console.log("21")
        for (i = 1; i < duplicateUser.ids.length; i++) {
            let duplicateUserInstance = duplicateUser.ids[i];
            const user = await getUserById(duplicateUserInstance._id);
            if (user) {
                try {
                    const lastSeenDate = new Date(duplicateUser.lastSeen);
                    const shouldSendMessage = (new Date() - lastSeenDate) < (60*60*24*1000*365*2);
                    await fixUser(user, autoFixableMessage, shouldSendMessage);
                } catch(err) {
                    console.log(err);
                }
            }  else {
                console.log("Error fixing up user - user not found by id")
            }
        }
    }

    console.log(`Duplicate users: ${duplicateUsers.length}`);
    console.log(`Unresolveable duplicate users: ${unresolveableDuplicateUsers.length}`);
    console.log(JSON.stringify(unresolveableDuplicateUsers));
}).catch((err) => {
    console.log("error with processlinebyline")
    console.log(err)
});

