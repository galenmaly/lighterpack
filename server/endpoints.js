const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');
const express = require('express');
const generate = require('nanoid/generate');

const router = express.Router();
const fs = require('fs');
const request = require('request');
const formidable = require('formidable');
const mongojs = require('mongojs');
const config = require('config');
const { logWithRequest } = require('./log.js');

const { authenticateUser, verifyPassword } = require('./auth.js');

let mailgun;

if (config.get('mailgunAPIKey')) {
    mailgun = require('mailgun-js')({ apiKey: config.get('mailgunAPIKey'), domain: config.get('mailgunDomain') });
}

const collections = ['users', 'libraries'];
const db = mongojs(config.get('databaseUrl'), collections);

const dataTypes = require('../client/dataTypes.js');

const Item = dataTypes.Item;
const Category = dataTypes.Category;
const List = dataTypes.List;
const Library = dataTypes.Library;

// one day in many years this can go away.
eval(`${fs.readFileSync(path.join(__dirname, './sha3.js'))}`);

router.post('/register', (req, res) => {
    const username = String(req.body.username).toLowerCase().trim();
    const password = String(req.body.password);
    let email = String(req.body.email);

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

    email = email.trim();

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

    db.users.find({ username }, (err, users) => {
        if (err || users.length) {
            logWithRequest(req, { message: 'User exists', username });
            return res.status(400).json({ errors: [{ field: 'username', message: 'That username already exists, please pick a different username.' }] });
        }

        db.users.find({ email }, (err, users) => {
            if (err || users.length) {
                logWithRequest(req, { message: 'User email exists', email });
                return res.status(400).json({ errors: [{ field: 'email', message: 'A user with that email already exists.' }] });
            }

            bcrypt.genSalt(10, (err, salt) => {
                bcrypt.hash(password, salt, (err, hash) => {
                    crypto.randomBytes(48, (ex, buf) => {
                        const token = buf.toString('hex');
                        let library;
                        if (req.body.library) {
                            try {
                                library = JSON.parse(req.body.library);
                            } catch (e) {
                                logWithRequest(req, { message: 'Library parsing issue', username });
                                return res.status(400).json({ errors: [{ message: 'Unable to parse your library. Contact support.' }] });
                            }
                        } else {
                            library = new Library().save();
                        }

                        const newUser = {
                            username,
                            password: hash,
                            email,
                            token,
                            library,
                            syncToken: 0,
                        };
                        logWithRequest(req, { message: 'Saving new user', username });
                        db.users.save(newUser);
                        const out = { username, library: JSON.stringify(newUser.library), syncToken: 0 };
                        res.cookie('lp', token, { path: '/', maxAge: 365 * 24 * 60 * 1000 });
                        return res.status(200).json(out);
                    });
                });
            });
        });
    });
});

router.post('/signin', (req, res) => {
    authenticateUser(req, res, returnLibrary);
});

function returnLibrary(req, res, user) {
    logWithRequest(req, { message: 'signed in', username: user.username });
    if (!user.syncToken) {
        user.syncToken = 0;
        db.users.save(user);
    }
    return res.json({ username: user.username, library: JSON.stringify(user.library), syncToken: user.syncToken });
}

router.post('/saveLibrary', (req, res) => {
    authenticateUser(req, res, saveLibrary);
});

function saveLibrary(req, res, user) {
    if (typeof req.body.syncToken === 'undefined') {
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

    if (req.body.syncToken != user.syncToken) {
        logWithRequest(req, { message: 'out of date syncToken', username: user.username });
        return res.status(400).json({ message: 'Your list is out of date - please refresh your browser.' });
    }

    let library;
    try {
        library = JSON.parse(req.body.data);
    } catch (e) {
        logWithRequest(req, { message: 'Library parsing issue', username: user.username });
        return res.status(400).json({ errors: [{ message: 'An error occurred while saving your data - unable to parse library. If this persists, please contact support.' }] });
    }

    user.library = library;
    user.syncToken++;
    db.users.save(user, () => {
        logWithRequest(req, { message: 'saved library', username: user.username });

        return res.status(200).json({ message: 'success', syncToken: user.syncToken });
    });
}

router.post('/externalId', (req, res) => {
    authenticateUser(req, res, externalId);
});

function externalId(req, res, user) {
    const id = generate('1234567890abcdefghijklmnopqrstuvwxyz', 6);
    logWithRequest(req, { message: 'Id generated', id });

    db.users.find({ 'library.lists.externalId': id }, (err, users) => {
        if (err) {
            logWithRequest(req, { message: 'Id lookup error', id });
            res.status(500).send('An error occurred.');
            return;
        }

        if (!users.length) {
            if (typeof user.externalIds === 'undefined') user.externalIds = [id];
            else user.externalIds.push(id);

            db.users.save(user);
            logWithRequest(req, { message: 'Id saved', id, username: user.username });
            res.status(200).json({ externalId: id });
        } else {
            logWithRequest(req, { message: 'Id collision detected', id });
            externalId(req, res, user);
        }
    });
}

router.post('/forgotPassword', (req, res) => {
    logWithRequest(req);
    const username = String(req.body.username).toLowerCase().trim();
    if (!username || username.length < 1 || username.length > 32) {
        logWithRequest(req, { message: 'Bad forgot password', username });
        return res.status(400).json({ errors: [{ message: 'Please enter a username.' }] });
    }

    db.users.find({ username }, (err, users) => {
        if (err) {
            logWithRequest(req, { message: 'Forgot password lookup error', username });
            return res.status(500).json({ message: 'An error occurred' });
        } if (!users.length) {
            logWithRequest(req, { message: 'Forgot password for unknown user', username });
            return res.status(500).json({ message: 'An error occurred.' });
        }
        const user = users[0];
        require('crypto').randomBytes(12, (ex, buf) => {
            const newPassword = buf.toString('hex');

            bcrypt.genSalt(10, (err, salt) => {
                bcrypt.hash(newPassword, salt, (err, hash) => {
                    user.password = hash;
                    const email = user.email;

                    const message = `Hello ${username},\n Apparently you forgot your password. Here's your new one: \n\n Username: ${username}\n Password: ${newPassword}\n\n If you continue to have problems, please reply to this email with details.\n\n Thanks!`;

                    const mailOptions = {
                        from: 'LighterPack <info@mg.lighterpack.com>',
                        to: email,
                        'h:Reply-To': 'LighterPack <info@lighterpack.com>',
                        subject: 'Your new LighterPack password',
                        text: message,
                    };

                    logWithRequest(req, { message: 'Attempting to send new password', email });
                    mailgun.messages().send(mailOptions, (error, response) => {
                        if (error) {
                            logWithRequest(req, error);
                            return res.status(500).json({ message: 'An error occurred' });
                        }
                        db.users.save(user);
                        const out = { username };
                        logWithRequest(req, { message: 'Message sent', response: response.message });
                        logWithRequest(req, { message: 'password changed for user', username });
                        return res.status(200).json(out);
                    });
                });
            });
        });
    });
});

router.post('/forgotUsername', (req, res) => {
    logWithRequest(req);
    const email = String(req.body.email).toLowerCase().trim();
    if (!email || email.length < 1) {
        logWithRequest(req, { message: 'Bad forgot username', email });
        return res.status(400).json({ errors: [{ message: 'Please enter a valid email.' }] });
    }

    db.users.find({ email }, (err, users) => {
        if (err) {
            logWithRequest(req, { message: 'Forgot email lookup error', email });
            return res.status(500).json({ message: 'An error occurred' });
        } if (!users.length) {
            logWithRequest(req, { message: 'Forgot email for unknown user', email });
            return res.status(400).json({ message: 'An error occurred' });
        }
        const user = users[0];
        const username = user.username;

        const message = `Hello ${username},\n Apparently you forgot your username. Here It is: \n\n Username: ${username}\n\n If you continue to have problems, please reply to this email with details.\n\n Thanks!`;

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
    });
});

router.post('/account', (req, res) => {
    authenticateUser(req, res, account);
});

function account(req, res, user) {
    // TODO: check for duplicate emails

    logWithRequest(req, { message: 'Starting account changes', username: user.username });
    verifyPassword(user.username, String(req.body.currentPassword))
        .then((user) => {
            if (req.body.newPassword) {
                const newPassword = String(req.body.newPassword);
                const errors = [];

                if (newPassword.length < 5 || newPassword.length > 60) {
                    errors.push({ field: 'newPassword', message: 'Please enter a password between 5 and 60 characters.' });
                }

                if (errors.length) {
                    return res.status(400).json({ errors });
                }

                bcrypt.genSalt(10, (err, salt) => {
                    bcrypt.hash(newPassword, salt, (err, hash) => {
                        user.password = hash;
                        logWithRequest(req, { message: 'Changing PW', username: user.username });

                        if (req.body.newEmail) {
                            user.email = String(req.body.newEmail);
                            logWithRequest(req, { message: 'Changing Email', username: user.username });
                        }

                        db.users.save(user);
                        return res.status(200).json({ message: 'success' });
                    });
                });
            } else if (req.body.newEmail) {
                user.email = String(req.body.newEmail);
                logWithRequest(req, { message: 'Changing Email', username: user.username });
                db.users.save(user);
                return res.status(200).json({ message: 'success' });
            }
        })
        .catch((err) => {
            logWithRequest(req, { message: 'Account bad current password', username: user.username });
            res.status(400).json({ errors: [{ field: 'currentPassword', message: 'Your current password is incorrect.' }] });
        });
}

router.post('/delete-account', (req, res) => {
    authenticateUser(req, res, deleteAccount);
});

function deleteAccount(req, res, user) {
    logWithRequest(req, { message: 'Starting account delete', username: user.username });

    verifyPassword(user.username, String(req.body.password))
        .then((user) => {
            if (req.body.username !== user.username) {
                logWithRequest(req, { message: 'Bad account deletion - wrong user', requestedUsername: req.body.username, initiatedby: user.username });
                return Promise.reject(new Error('An error occurred, please try logging out and in again.'));
            }

            db.users.remove(user, true);

            logWithRequest(req, { message: 'Completed account delete', username: user.username });

            return res.status(200).json({ message: 'success' });
        })
        .catch((err) => {
            logWithRequest(req, { message: 'Bad account deletion - invalid password', username: req.body.username });
            res.status(400).json({ errors: [{ field: 'currentPassword', message: 'Your current password is incorrect.' }] });
        });
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
        const imgurRequest = request.defaults({ json: true });
        fs.readFile(path, (e, img_data) => {
            const temp = { uri: 'https://api.imgur.com/3/image', headers: { Authorization: `Client-ID ${config.get('imgurClientID')}` } };
            temp.body = img_data.toString('base64');
            imgurRequest.post(temp, (e, r, body) => {
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
    });
}

module.exports = router;
