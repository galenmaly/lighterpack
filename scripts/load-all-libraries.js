const config = require('config');
const request = require('request');
const mongojs = require('mongojs');

const newDataTypes = require('../client/dataTypes.js');

const NewLibrary = newDataTypes.Library;

const collections = ['users_prod', 'libraries'];

const db = mongojs(config.get('databaseUrl'), collections);

let successfulUsersCount = 0;
let erroredUsersCount = 0;
const erroredUsers = [];

console.log('loading users....');
db.users_prod.find({}, (err, users) => {
    if (!users.length) {
        console.log('no users found');
        return;
    }

    for (const i in users) {
        const user = users[i];
        console.log(user.username);
        const library = new NewLibrary();
        try {
            library.load(user.library);
            successfulUsersCount++;
        } catch (err) {
            console.log(`${user.username} - ${err}`);
            erroredUsers.push(user.username);
            erroredUsersCount++;
        }
        const listIds = user.library.lists.map(list => list.externalId);
    }
    console.log('complete');
    console.log('---');
    console.log(`successful users: ${successfulUsersCount}`);
    console.log(`errored users: ${erroredUsersCount}`);
    console.log('---');
    console.log(erroredUsers);
});
