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

console.log("loading users....")
db.users_prod.find({}, function(err, users) {
    if (!users.length) {
        console.log("no users found");
        return;
    }

    for (var i in users) {
        var user = users[i];
        console.log(user.username);
        let library = new NewLibrary();
        try {
            library.load(user.library);
            successfulUsersCount ++;
        } catch (err) {
            console.log(user.username + " - " + err);
            erroredUsers.push(user.username);
            erroredUsersCount ++;
        }
        let listIds = user.library.lists.map((list) => {
            return list.externalId;
        });
    }
    console.log("complete");
    console.log("---")
    console.log("successful users: " + successfulUsersCount)
    console.log("errored users: " + erroredUsersCount)
    console.log("---")
    console.log(erroredUsers)
});
