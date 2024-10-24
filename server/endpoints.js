const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');
const express = require('express');
const generate = require('nanoid/generate');
const { promisify } = require('util')

const router = express.Router();
const fs = require('fs');
const request = require('request');
const formidable = require('formidable');
const config = require('config');
const { logWithRequest } = require('./log.js');

const { authenticateUser, verifyPassword } = require('./auth.js');

let mailgun;

if (config.get('mailgunAPIKey')) {
    mailgun = require('mailgun-js')({ apiKey: config.get('mailgunAPIKey'), domain: config.get('mailgunDomain') });
}

const knex = require('knex')({
    client: 'pg',
    connection: config.util.cloneDeep(config.get('pgDatabase'))
});

const randomBytesAsync = promisify(crypto.randomBytes);
const mailgunSendAsync = promisify(mailgun.messages().send);

const dataTypes = require('../client/dataTypes.js');

const Item = dataTypes.Item;
const Category = dataTypes.Category;
const List = dataTypes.List;
const Library = dataTypes.Library;

// one day in many years this can go away.
eval(`${fs.readFileSync(path.join(__dirname, './sha3.js'))}`);

router.post('/register', (req, res) => {
    register(req, res);
});

async function register(req, res) {
    const username = String(req.body.username).toLowerCase().trim();
    const password = String(req.body.password);
    let email = String(req.body.email).trim();

    const errors = [];

    if (!username) {
        errors.push({ field: 'username', message: 'Please enter a username.' });
    }

    if (username && (username.length < 3 || username.length > 32)) {
        errors.push({ field: 'username', message: 'Please enter a username between 3 and 32 characters.' });
    }

    if (!email) {
        errors.push({ field: 'email', message: 'Please enter an email.' });
    }

    if (!password) {
        errors.push({ field: 'password', message: 'Please enter a password.' });
    }

    if (password && (password.length < 5 || password.length > 60)) {
        errors.push({ field: 'password', message: 'Please enter a password between 5 and 60 characters.' });
    }

    if (errors.length) {
        return res.status(400).json({ errors });
    }

    logWithRequest(req, { message: 'Attempting to register', username });

    try {
        let conflictingUsers = await knex('users')
            .where({ username })
            .orWhere({ email })
            .select();
        
        if (conflictingUsers.length) {
            if (conflictingUsers[0].username === username || (conflictingUsers.length > 0 && conflictingUsers[0].username === username)) { //hacky
                logWithRequest(req, { message: 'User exists', username });
                return res.status(400).json({ errors: [{ field: 'username', message: 'That username already exists, please pick a different username.' }] });
            } else if (conflictingUsers[0].email === email || (conflictingUsers.length > 0 && conflictingUsers[0].email === email)) { //hacky
                logWithRequest(req, { message: 'User email exists', email });
                return res.status(400).json({ errors: [{ field: 'email', message: 'A user with that email already exists.' }] });
            } else {
                logWithRequest(req, { message: 'User creation failed for unknown reason', conflictingUsers });
                return res.status(500).json({ errors: [{ message: 'An unexpected error occurred.' }] });
            }
        }
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);
        const tokenBuffer = await randomBytesAsync(48);
        const token = tokenBuffer.toString('hex');

        let library;
        if (req.body.library) {
            try {
                library = JSON.parse(req.body.library);
            } catch (err) {
                logWithRequest(req, { message: 'Library parsing issue', username, err, libInput: req.body.library });
                return res.status(400).json({ errors: [{ message: 'Unable to parse your library. Contact support.' }] });
            }
        } else {
            library = new Library().save();
        }

        const newSyncToken = 0;

        const newUser = {
            username,
            password: hash,
            email,
            token,
            library,
            sync_token: newSyncToken,
        };

        logWithRequest(req, { message: 'Saving new user', username });

        try {
            await knex('users').insert(newUser)
            const out = { username, library: JSON.stringify(newUser.library), sync_token: newSyncToken };
            res.cookie('lp', token, { path: '/', maxAge: 365 * 24 * 60 * 1000 });
            return res.status(200).json(out);
        } catch (err) {
            logWithRequest(req, { message: 'Error inserting user', newUser, err });
            return res.status(500).json({ errors: [{ message: 'An error occurred when registering.' }] });
        }
    } catch (err) {
        logWithRequest(req, { message: 'Error searching for conflicting users', err });
        return res.status(500).json({ errors: [{ message: 'An error occurred.' }] });
    }
}

router.post('/signin', (req, res) => {
    authenticateUser(req, res, returnLibrary);
});

function returnLibrary(req, res, user) {
    logWithRequest(req, { message: 'signed in', username: user.username });
    return res.json({ username: user.username, library: JSON.stringify(user.library), sync_token: user.sync_token });
}

router.post('/saveLibrary', (req, res) => {
    authenticateUser(req, res, saveLibrary);
});

async function saveLibrary(req, res, user) {
    if (typeof req.body.sync_token === 'undefined') { // TODO: is this safe to delete?
        logWithRequest(req, { message: 'Missing syncToken', username: user.username });
        return res.status(400).send('Please refresh this page to upgrade to the latest version of LighterPack.');
    }
    if (!req.body.username || !req.body.data) {
        logWithRequest(req, { message: 'bad save: missing username or data', username: user.username });
        return res.status(400).json({ message: 'An error occurred while saving your data. Please refresh your browser and try again.' });
    }

    if (req.body.username != user.username) {
        logWithRequest(req, { message: 'bad save: bad username', initatedby: user.username, initiatedfor: req.body.username });
        return res.status(401).json({ message: 'An error occurred while saving your data. Please refresh your browser and login again.' });
    }

    if (req.body.sync_token != user.sync_token) {
        logWithRequest(req, { message: 'out of date syncToken', username: user.username });
        return res.status(400).json({ message: 'Your list is out of date - please refresh your browser.' });
    }

    let library;
    try {
        library = JSON.parse(req.body.data);
    } catch (e) {
        logWithRequest(req, { message: 'Library parsing issue', username: user.username });
        return res.status(400).json({ errors: [{ message: 'An error occurred while saving your data - unable to parse library.' }] });
    }

    let newSyncToken = user.sync_token++;

    try {
        await knex('users')
        .where({ user_id: user.user_id })
        .update({
            library: library,
            sync_token: newSyncToken
        });

        logWithRequest(req, { message: 'saved library', username: user.username });
        return res.status(200).json({ message: 'success', sync_token: user.sync_token });
    } catch (err) {
        logWithRequest(req, { message: 'Library saving error', username: user.username, err });
        return res.status(500).json({ errors: [{ message: 'An error occurred while saving your data.' }] });
    }
}

router.post('/externalId', (req, res) => {
    authenticateUser(req, res, externalId);
});

async function externalId(req, res, user) {
    const id = generate('1234567890abcdefghijklmnopqrstuvwxyz', 6);
    logWithRequest(req, { message: 'Id generated', id });

    try {
        const lists = await knex('list').where({ external_id: id })

        if (lists.length) {
            logWithRequest(req, { message: 'Id collision detected', id });
            externalId(req, res, user);
            return;
        }

        try {
            await knex('list').insert({
                external_id: id,
                user_id: user.user_id
            });
        } catch (err) {
            logWithRequest(req, { message: 'Error inserting externalID', err });
            return res.status(500).json({ errors: [{ message: 'An error occurred.' }] });
        }   

        logWithRequest(req, { message: 'Id saved', id, username: user.username });
        res.status(200).json({ externalId: id });
    } catch (err) {
        logWithRequest(req, { message: 'Id lookup error', id, err });
        return res.status(500).send('An error occurred.');
    }
}

router.post('/forgotPassword', (req, res) => {
    forgotPassword(req, res);
});

async function forgotPassword(req, res) {
    logWithRequest(req);

    const username = String(req.body.username).toLowerCase().trim();
    if (!username || username.length < 1 || username.length > 32) {
        logWithRequest(req, { message: 'Bad forgot password', username });
        return res.status(400).json({ errors: [{ message: 'Please enter a username.' }] });
    }

    try {
        const users = await knex('users').select({username});

        if (!users.length) {
            logWithRequest(req, { message: 'Forgot password for unknown user', username });
            return res.status(500).json({ message: 'An error occurred.' });
        }

        const user = users[0];

        const newPassword = generate(12);
        const salt = await bcrypt.genSalt(10);
        const newPasswordHash = await bcrypt.hash(newPassword, salt);

        const email = user.email;

        const message = `Hello ${username},\n It looks like you forgot your password. Here's your new one: \n\n Username: ${username}\n Password: ${newPassword}\n\n If you continue to have problems, please reply to this email with details.\n\n Thanks!`;

        const mailOptions = {
            from: 'LighterPack <info@mg.lighterpack.com>',
            to: email,
            'h:Reply-To': 'LighterPack <info@lighterpack.com>',
            subject: 'Your new LighterPack password',
            text: message,
        };

        logWithRequest(req, { message: 'Attempting to send new password', email });
        try {
            const mailgunResponse = await mailgunSendAsync(mailOptions);
        } catch (err) {
            logWithRequest(req, err);
            return res.status(500).json({ message: 'An error occurred' });
        }

        try {
            await knex('users').where({user_id: user.user_id}).update({
                password: newPasswordHash
            });

            logWithRequest(req, { message: 'Message sent', response: mailgunResponse.message });
            logWithRequest(req, { message: 'password changed for user', username });
            return res.status(200).json({ username });
        } catch (err) {
            logWithRequest(req, { message: 'Error saving new password', err });
            return res.status(500).json({ message: 'An error occurred' });
        }
    } catch (err) {
        logWithRequest(req, { message: 'Forgot password lookup error', username });
        return res.status(500).json({ message: 'An error occurred' });
    }
};

async function forgotUsername(req, res) {
    logWithRequest(req);

    const email = String(req.body.email).toLowerCase().trim();

    if (!email || email.length < 1) {
        logWithRequest(req, { message: 'Bad forgot username', email });
        return res.status(400).json({ errors: [{ message: 'Please enter a valid email.' }] });
    }

    try {
        const users = await knex('users').select({email});

        if (!users.length) {
            logWithRequest(req, { message: 'Forgot email for unknown user', email });
            return res.status(400).json({ message: 'An error occurred' });
        }
        
        const user = users[0];
        const username = user.username;

        const message = `Hello ${username},\n It looks like you forgot your username. Here It is: \n\n Username: ${username}\n\n If you continue to have problems, please reply to this email with details.\n\n Thanks!`;

        
        const mailOptions = {
            from: 'LighterPack <info@mg.lighterpack.com>',
            to: email,
            'h:Reply-To': 'LighterPack <info@lighterpack.com>',
            subject: 'Your LighterPack username',
            text: message,
        };

        logWithRequest(req, { message: 'Attempting to send username', email, username });
        mailgun.messages().send(mailOptions, (error, response) => {
            if (error) {
                logWithRequest(req, error);
                return res.status(500).json({ message: 'An error occurred' });
            }
            const out = { email };
            logWithRequest(req, { message: 'Message sent', response: response.message });
            logWithRequest(req, { message: 'sent username message for user', username, email });
            return res.status(200).json(out);
        });
    } catch (err) {
        logWithRequest(req, { message: 'Forgot email lookup error', email });
        return res.status(500).json({ message: 'An error occurred' });
    }
}

router.post('/forgotUsername', (req, res) => {
    forgotUsername(req, res);
});

router.post('/account', (req, res) => {
    authenticateUser(req, res, account);
});

async function account(req, res, user) {
    logWithRequest(req, { message: 'Starting account changes', username: user.username });
    try {
        await verifyPassword(user.username, String(req.body.currentPassword)); //throws error if invalid

        if (req.body.newPassword) {
            const newPassword = String(req.body.newPassword);
            const errors = [];

            if (newPassword.length < 5 || newPassword.length > 60) {
                errors.push({ field: 'newPassword', message: 'Please enter a password between 5 and 60 characters.' });
            }

            if (errors.length) {
                return res.status(400).json({ errors });
            }

            const salt = await bcrypt.genSalt(10);
            const newPasswordHash = await bcrypt.hash(newPassword, salt);

            logWithRequest(req, { message: 'Changing PW', username: user.username });

            await knex('users').where({user_id: user.user_id}).update({
                password: newPasswordHash
            });
        } 
        
        if (req.body.newEmail) {
            let email = String(req.body.newEmail).trim();

            let conflictingUsers = await knex('users')
                .where({ email })
                .select();

            if (conflictingUsers.length) {
                logWithRequest(req, { message: 'User email exists', email });
                return res.status(400).json({ errors: [{ field: 'email', message: 'A user with that email already exists.' }] });
            }

            logWithRequest(req, { message: 'Changing Email', username: user.username });

            await knex('users').where({user_id: user.user_id}).update({
                email
            });
        }

        return res.status(200).json({ message: 'success' });
    } catch (err) {
        logWithRequest(req, { message: 'Account bad current password', username: user.username, err });
        res.status(400).json({ errors: [{ field: 'currentPassword', message: 'Your current password is incorrect.' }] });
    }
}

router.post('/delete-account', (req, res) => {
    authenticateUser(req, res, deleteAccount);
});

async function deleteAccount(req, res, user) {
    logWithRequest(req, { message: 'Starting account delete', username: user.username });

    try {
        await verifyPassword(user.username, String(req.body.password)); //throws error if invalid

        if (req.body.username !== user.username) {
            logWithRequest(req, { message: 'Bad account deletion - wrong user', requestedUsername: req.body.username, initiatedby: user.username });
            return res.status(400).json({ message: 'An error occurred, please try logging out and in again.'});
        }

        await knex('users').where({username: user.username}).del();

        logWithRequest(req, { message: 'Completed account delete', username: user.username });

        return res.status(200).json({ message: 'success' });
    } catch (err) {
        logWithRequest(req, { message: 'Bad account deletion - invalid password', username: req.body.username, err });
        res.status(400).json({ errors: [{ field: 'currentPassword', message: 'Your current password is incorrect.' }] });
    }
}

router.post('/imageUpload', (req, res) => {
    // authenticateUser(req, res, imageUpload);
    imageUpload(req, res, {});
});

function imageUpload(req, res, user) {
    const form = new formidable.IncomingForm();
    form.parse(req, (err, fields, files) => {
        if (err) {
            logWithRequest(req, 'form parse error');
            return res.status(500).json({ message: 'An error occurred' });
        }
        if (!files || !files.image) {
            logWithRequest(req, 'No image in upload');
            return res.status(500).json({ message: 'An error occurred' });
        }

        const path = files.image.path;
        const formData = {
            image: fs.createReadStream(path),
            type: "file"
        };
        request.post({
            url: 'https://api.imgur.com/3/image',
            headers: { Authorization: `Client-ID ${config.get('imgurClientID')}` },
            formData
        }, (e, r, body) => {
            if (e) {
                logWithRequest(req, 'imgur post fail!');
                logWithRequest(req, e);
                logWithRequest(req, body);
                return res.status(500).json({ message: 'An error occurred.' });
            } if (!body) {
                logWithRequest(req, 'imgur post fail!!');
                logWithRequest(req, e);
                return res.status(500).json({ message: 'An error occurred.' });
            } if (r.statusCode !== 200 || body.error) {
                logWithRequest(req, 'imgur post fail!!!');
                logWithRequest(req, e);
                logWithRequest(req, body);
                return res.status(500).json({ message: 'An error occurred.' });
            }
            logWithRequest(req, body);
            return res.send(body);
        });
    });
}

module.exports = router;
