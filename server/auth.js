const fs = require('fs');
const path = require('path');
const config = require('config');
const { promisify } = require('util')

const knex = require('knex')({
    client: 'pg',
    connection: config.util.cloneDeep(config.get('pgDatabase'))
});

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { logWithRequest } = require('./log.js');

const moderatorList = config.get('moderators');

const randomBytesAsync = promisify(crypto.randomBytes);

// one day in many years this can go away.
eval(`${fs.readFileSync(path.join(__dirname, './sha3.js'))}`);

const authenticateModerator = async function (req, res, callback) {
    authenticateUser(req, res, (req, res, user) => {
        if (!isModerator(user.username)) {
            return res.status(403).json({ message: 'Denied.' });
        }
        callback(req, res, user);
    });
};

const authenticateUser = async function (req, res, callback) {
    if (!req.cookies.lp && (!req.body.username || !req.body.password)) {
        return res.status(401).json({ message: 'Please log in.' });
    }

    if (req.body.username && req.body.password) {
        const username = String(req.body.username).toLowerCase().trim();
        const password = String(req.body.password);

        try {
            const user = await verifyPassword(username, password);

            generateSession(req, res, user, callback);
        } catch (err) {
            logWithRequest(req, err);
            if (err.code && err.message) {
                logWithRequest(req, { message: `error on verifyPassword for: ${username}`, error: err.message });
                res.status(err.code).json({ message: err.message });
            } else {
                res.status(500).json({ message: 'An error occurred, please try again later.' });
            }
        }
    } else {
        const token = String(req.cookies.lp);

        try {
            const users = await knex('users').select().where({token});

            if (!users.length) {
                logWithRequest(req, { message: 'bad cookie!' });
                return res.status(404).json({ message: 'Please log in again.' });
            }

            const user = users[0];

            req.lighterpackusername = user.username || 'UNKNOWN';
            callback(req, res, user);
        } catch (err) {
            logWithRequest(req, { message: 'Error on authenticateUser else', error: err });
            return res.status(500).json({ message: 'An error occurred, please try again later.' });
        }
    }
};

const verifyPassword = async function (username, password) {
    try {
        const users = await knex('users').select().where({username});
        
        if (!users.length) {
            throw new Error({ code: 404, message: 'Invalid username and/or password.' });
        }

        const user = users[0];
        const match = await  bcrypt.compare(password, user.password);

        if (match) {
            return user;
        }

        /* TODO: remove the below steps & force password reset of non-updated passwords */
        const sha3password = CryptoJS.SHA3(password + username).toString(CryptoJS.enc.Base64);
        const sha3Match = await bcrypt.compare(sha3password, user.password);

        if (sha3Match) {
            const salt = await bcrypt.genSalt(10);
            const newPasswordHash = await bcrypt.hash(password, salt);

            await knex('users').where({username}).update({
                password: newPasswordHash
            });

            return user;
        }

        if (sha3password === user.password) { 
            const salt = await bcrypt.genSalt(10);
            const newPasswordHash = await bcrypt.hash(password, salt);

            await knex('users').where({username}).update({
                password: newPasswordHash
            });

            return user;
        }

        throw new Error({ code: 404, message: 'Invalid username and/or password.' });
    } catch (err) {
        throw new Error({ code: 500, message: 'An error occurred, please try again later.' });
    }
};

const generateSession = async function (req, res, user, callback) {
    const tokenBuffer = await randomBytesAsync(48);
    const token = tokenBuffer.toString('hex');

    await knex('users').where({user_id: user.user_id}).update({
        token
    });

    res.cookie('lp', token, { path: '/', maxAge: 365 * 24 * 60 * 1000 });
    callback(req, res, user);
};

function isModerator(username) {
    return moderatorList.indexOf(username) > -1;
}

module.exports = {
    authenticateModerator,
    authenticateUser,
    verifyPassword,
    generateSession,
    isModerator,
};
