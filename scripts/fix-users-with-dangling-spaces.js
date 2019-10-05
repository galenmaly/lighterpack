const config = require('config');
const mongojs = require('mongojs');

const collections = ['users', 'libraries'];
const db = mongojs(config.get('databaseUrl'), collections);

if (config.get('mailgunAPIKey')) {
    var mailgun = require('mailgun-js')({ apiKey: config.get('mailgunAPIKey'), domain: config.get('mailgunDomain') });
}

const autoFixableMessage = "Hello ${originalUsername},\n\nWhile performing some system updates we noticed your username had some extra spaces at the beginning or end of it. We were able to rename your username to remove the extraneous spaces. Your new username is ${newUsername}. \n\nYou will have to reset your password to be able log in again which can be done at https://lighterpack.com/forgot-password \n\nApologies for any inconvenience, and if you have any isssues please reply to this email with details. \n\nThanks! \n\nThe LighterPack team";

const samePersonMessage = "Hello ${originalUsername},\n\nWhile performing some system updates we noticed you have a user with some extra spaces at the beginning or end of the username. We noticed you also have a separate account with the username with spaces removed. Apologies for any inconvience this has caused. If you need access the user that formerly had spaces in it, we've changed the username to ${newUsername}. \n\nYou will have to reset the password of this account to be able log in again which can be done at https://lighterpack.com/forgot-password \n\nApologies for any inconvenience, if you have any isssues please reply to this email with details. \n\nThanks! \n\nThe LighterPack team";

const differentPersonMessage = "Hello ${originalUsername},\n\nWhile performing some system updates we noticed your username had some extra spaces at the beginning or end of it. Unfortunately, the username without spaces is taken by someone else, so your new username is ${newUsername}. \n\nIf you would like your username changed to something new please respond to this email and let me know your preferred new username. \n\nYou will have to reset your password to be able log in again, which can be done at https://lighterpack.com/forgot-password \n\nIf you have any isssues please reply to this email with details. \n\nThanks! \n\nThe LighterPack team";


console.log('loading users....');
getAllDanglingUsers()
    .then(determineFixabilities)
    .then(({ autoFixableUsers, samePersonUsers, differentPersonUsers }) => {
        console.log(`total # of dangling users: ${autoFixableUsers.length + samePersonUsers.length + differentPersonUsers.length}`);
        console.log(`total # of different person dangling users: ${differentPersonUsers.length}`);
        console.log(`total # of autofixable dangling users: ${autoFixableUsers.length}`);
        console.log(`total # of same person dangling users: ${samePersonUsers.length}`);

        console.log ('---- starting fix ----');

        fixUsers(autoFixableUsers, autoFixableMessage)
        .then(() => {
            return fixUsers(samePersonUsers, samePersonMessage);
        })
        .then(() => {
            return fixUsers(differentPersonUsers, differentPersonMessage);
        })
        .then(() => {
            console.log('---- done ----');
        });
    });

function getAllDanglingUsers() {
    return new Promise((resolve, reject) => {
        db.users.find({}, (err, users) => {
            if (!users.length) {
                console.log('no users found');
                return;
            }
            console.log('searching for users with dangling spaces...');
            const danglingUsers = [];

            for (const i in users) {
                const user = users[i];

                if (user.username !== user.username.trim() && user.username.trim() !== '') {
                    danglingUsers.push(user);
                }
            }
            resolve(danglingUsers);
        });
    });
}

function determineFixabilities(danglingUsers, differentPersonUsers = [], samePersonUsers = [], autoFixableUsers = []) {
    return new Promise((resolve, reject) => {
        if (!danglingUsers.length) {
            resolve({ differentPersonUsers, samePersonUsers, autoFixableUsers });
            return;
        }
        const danglingUser = danglingUsers.pop();
        determineUserFixability(danglingUser)
            .then((fixability) => {
                if (fixability === 'auto') {
                    autoFixableUsers.push(danglingUser);
                } else if (fixability === 'samePersonUsers') {
                    samePersonUsers.push(danglingUser);
                } else {
                    differentPersonUsers.push(danglingUser);
                }

                determineFixabilities(danglingUsers, differentPersonUsers, samePersonUsers, autoFixableUsers)
                    .then(resolve)
                    .catch(reject);
            });
    });
}

function determineUserFixability(danglingUser) {
    return new Promise((resolve, reject) => {
        db.users.find({ username: danglingUser.username.trim() }, (err, trimmedUsers) => {
            if (trimmedUsers.length > 0) {
                trimmedUser = trimmedUsers[0];
                if (trimmedUser.email === danglingUser.email) {
                    resolve('samePersonUsers');
                    return;
                }
                resolve('differentPersonUsers');
                return;
            }
            resolve('auto');
        });
    });
}

function fixUsers(users, messageTemplate) {
    return new Promise((resolve, reject) => {
        if (!users.length) {
            resolve();
            return;
        }
        const user = users.pop();
        fixUser(user, messageTemplate)
        .then(() => {
            resolve(fixUsers(users, messageTemplate));
        })
        .catch(reject);
    });
}

function fixUser(user, messageTemplate) {
    return new Promise((resolve, reject) => {
        const originalUsername = user.username;
        findNewUsername(user.username.trim())
        .then((newUsername) => {
            return renameUser(user, newUsername);
        })
        .then(() => {
            return messageUser(user, originalUsername, messageTemplate);
        })
        .then(() => {
            console.log(originalUsername);
            resolve();
        })
        .catch(reject);
    });
}

function messageUser(user, originalUsername, messageTemplate) {
    return new Promise((resolve, reject) => {
        const newUsername = user.username;

        let message = messageTemplate.replace("${originalUsername}", originalUsername);
        message = message.replace("${newUsername}", newUsername);

        const mailOptions = {
            from: 'LighterPack <info@mg.lighterpack.com>',
            to: user.email,
            "h:Reply-To": "LighterPack <info@lighterpack.com>",
            subject: 'LighterPack account update',
            text: message,
        };
        

        mailgun.messages().send(mailOptions, (error, response) => {
            if (error) {
                reject(error);
                return;
            }
            resolve();
        });
    });
}

function renameUser(user, newUsername) {
    return new Promise((resolve, reject) => {
        user.username = newUsername;
        db.users.save(user);
        resolve();
    });
}

function findNewUsername(trimmedUsername, suffix = 0) {
    return new Promise((resolve, reject) => {
        let newUsername;
        if (!suffix) {
            newUsername = trimmedUsername;
        } else {
            newUsername = trimmedUsername + String(suffix);
        }
        db.users.find({ username: newUsername }, (err, existingUsers) => {
            if (err) {
                reject(err);
                return;
            }
            if (existingUsers.length) {
                resolve(findNewUsername(trimmedUsername, suffix + 1));
                return;
            }

            resolve(newUsername);
        });
    });
}