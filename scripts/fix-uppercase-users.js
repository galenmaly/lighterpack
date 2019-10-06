const config = require('config');
const mongojs = require('mongojs');

const collections = ['users', 'libraries'];

const db = mongojs(config.get('databaseUrl'), collections);

console.log('loading users....');
db.users.find({username: { '$regex' : '[A-Z]'} }, (err, users) => {
    if (!users.length) {
        console.log('no users found');
        return;
    }
    console.log('searching for users...');

    for (const i in users) {
        var user = users[i];
        console.log(user.username);
        user.username = user.username.toLowerCase();
        db.users.save(user);
    }
    console.log('complete');
});
