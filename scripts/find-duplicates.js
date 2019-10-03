const config = require('config');
const mongojs = require('mongojs');

const newDataTypes = require('../client/dataTypes.js');

const collections = ['users_prod', 'libraries'];

const db = mongojs(config.get('databaseUrl'), collections);

const erroredUsers = [];

console.log("loading users....")
db.users_prod.find({}, function(err, users) {
    if (!users.length) {
        console.log("no users found");
        return;
    }
    console.log("searching for duplicates...");

    for (var i in users) {
        var user = users[i];
        var foundIds = [];
        var userErrored = false;
        var library = new newDataTypes.Library();
        library.load(user.library);
        var serialized = library.save();

        serialized.items.forEach((item) => {
            if (foundIds.indexOf(item.id) > -1) {
                console.log("Found duplicate Id for: " + user.username + " (item) " + item.id);
                userErrored = true;
                return;
            }
            foundIds.push(item.id);
        });
        serialized.categories.forEach((category) => {
            if (foundIds.indexOf(category.id) > -1) {
                console.log("Found duplicate Id for: " + user.username + " (category)" + category.id);
                userErrored = true;
                return;
            }
            foundIds.push(category.id)
        });

        serialized.lists.forEach((list) => {
            if (foundIds.indexOf(list.id) > -1) {
                console.log("Found duplicate Id for: " + user.username + " (list)" + list.id);
                userErrored = true;
                return;
            }
            foundIds.push(list.id)
        });

        if (userErrored) {
            erroredUsers.push(user.username);
        }
    }
    console.log("complete");
    console.log("---")
    console.log("total # of errored users: " + erroredUsers.length);
    console.log("---")
    console.log(erroredUsers)
});
