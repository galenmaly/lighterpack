const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');
const express = require('express');

const router = express.Router();
const fs = require('fs');
const request = require('request');
const formidable = require('formidable');
const mongojs = require('mongojs');
const config = require('config');
const awesomeLog = require('./log.js');

if (config.get('mailgunAPIKey')) {
    const domain = 'lighterpack.com';
    var mailgun = require('mailgun-js')({ apiKey: config.get('mailgunAPIKey'), domain });
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
    let username = req.body.username;
    const password = req.body.password;
    let email = req.body.email;

    const errors = [];

    if (!username) {
        errors.push({ field: 'username', message: 'Please enter a username.' });
    }

    username = username.trim();

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

    awesomeLog(req, username);

    db.users.find({ username }, (err, users) => {
        if (err || users.length) {
            awesomeLog(req, 'User exists.');
            return res.status(400).json({ errors: [{ field: 'username', message: 'That username already exists, please pick a different username.' }] });
        }

        db.users.find({ email }, (err, users) => {
            if (err || users.length) {
                awesomeLog(req, 'User email exists.');
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
                        awesomeLog(req, 'Saving new user.');
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
    awesomeLog(req, user.username);
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
    if (!req.body.username || typeof req.body.syncToken === 'undefined' || !req.body.data) {
        return res.status(400).json({ message: 'An error occurred while saving your data.' });
    }

    if (req.body.username != user.username) {
        return res.status(401).json({ message: 'Please login again.' });
    }

    if (req.body.syncToken != user.syncToken) {
        return res.status(400).json({ message: 'Your list is out of date - please refresh your browser.' });
    }

    let library;
    try {
        library = JSON.parse(req.body.data);
    } catch (e) {
        return res.status(400).json({ errors: [{ message: 'An error occurred while saving your data - unable to parse library. If this persists, please contact support.' }] });
    }

    user.library = library;
    user.syncToken++;
    db.users.save(user, () => {
        awesomeLog(req, user.username);

        return res.status(200).json({ message: 'success', syncToken: user.syncToken });
    });
}

router.post('/externalId', (req, res) => {
    authenticateUser(req, res, externalId);
});

function externalId(req, res, user) {
    const filePath = path.join(__dirname, '../extIds.txt');

    fs.readFile(filePath, (err, data) => {
        if (!err) {
            data = data.toString();
            const position = data.indexOf('\n');
            if (position != -1) {
                const myId = data.substr(0, position).trim();
                data = data.substr(position + 1);
                fs.writeFile(filePath, data, (err) => {
                    if (err) {
                        awesomeLog(req, err);
                    }
                });
                awesomeLog(req, `${user.username} - ${myId}`);

                if (typeof user.externalIds === 'undefined') user.externalIds = [myId];
                else user.externalIds.push(myId);

                db.users.save(user);

                return res.status(200).json({ externalId: myId });
            }
            awesomeLog(req, 'External ID File: no lines found!!!111oneoneone');
            return res.status(500).json({ message: 'An error occurred, please try again later.' });
        }
        awesomeLog(req, 'ERROR OPENING EXTERNAL ID FILE');
        awesomeLog(req, err);
        return res.status(500).json({ message: 'An error occurred, please try again later.' });
    });
}

router.post('/forgotPassword', (req, res) => {
    awesomeLog(req);
    let username = req.body.username;
    if (!username) {
        awesomeLog(req, `Bad forgot password:${username}`);
        return res.status(400).json({ errors: [{ message: 'Please enter a username.' }] });
    }

    username = username.trim();

    if (username.length < 1 || username.length > 32) {
        awesomeLog(req, `Bad forgot password:${username}`);
        return res.status(400).json({ errors: [{ message: 'Please enter a username.' }] });
    }

    db.users.find({ username }, (err, users) => {
        if (err) {
            awesomeLog(req, `Forgot password lookup error for:${username}`);
            return res.status(500).json({ message: 'An error occurred' });
        } if (!users.length) {
            awesomeLog(req, `Forgot password for unknown user:${username}`);
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
                        from: 'LighterPack <info@lighterpack.com>',
                        to: email,
                        subject: 'Your new LighterPack password',
                        text: message,
                    };

                    awesomeLog(req, `Attempting to send new password to:${email}`);
                    mailgun.messages().send(mailOptions, (error, response) => {
                        if (error) {
                            awesomeLog(req, error);
                            return res.status(500).json({ message: 'An error occurred' });
                        }
                        db.users.save(user);
                        const out = { username };
                        awesomeLog(req, `Message sent: ${response.message}`);
                        awesomeLog(req, `password changed for user:${username}`);
                        return res.status(200).json(out);
                    });
                });
            });
        });
    });
});

router.post('/forgotUsername', (req, res) => {
    awesomeLog(req);
    let email = req.body.email;
    if (!email) {
        awesomeLog(req, `Bad forgot username:${email}`);
        return res.status(400).json({ errors: [{ message: 'Please enter a valid email.' }] });
    }

    email = email.trim();

    if (email.length < 1) {
        awesomeLog(req, `Bad forgot username:${email}`);
        return res.status(400).json({ errors: [{ message: 'Please enter a valid email.' }] });
    }

    db.users.find({ email }, (err, users) => {
        if (err) {
            awesomeLog(req, `Forgot email lookup error for:${email}`);
            return res.status(500).json({ message: 'An error occurred' });
        } if (!users.length) {
            awesomeLog(req, `Forgot email for unknown user:${email}`);
            return res.status(400).json({ message: 'An error occurred' });
        }
        const user = users[0];
        const username = user.username;

        const message = `Hello ${username},\n Apparently you forgot your username. Here It is: \n\n Username: ${username}\n\n If you continue to have problems, please reply to this email with details.\n\n Thanks!`;

        const mailOptions = {
            from: 'LighterPack <info@lighterpack.com>',
            to: email,
            subject: 'Your LighterPack username',
            text: message,
        };

        awesomeLog(req, `Attempting to send username to:${email}`);
        mailgun.messages().send(mailOptions, (error, response) => {
            if (error) {
                awesomeLog(req, error);
                return res.status(500).json({ message: 'An error occurred' });
            }
            const out = { email };
            awesomeLog(req, `Message sent: ${response.message}`);
            awesomeLog(req, `sent username message for user:${username}`);
            return res.status(200).json(out);
        });
    });
});

router.post('/account', (req, res) => {
    authenticateUser(req, res, account);
});

function account(req, res, user) {
    // TODO: check for duplicate emails

    verifyPassword(user.username, req.body.currentPassword)
        .then((user) => {
            if (req.body.newPassword) {
                const errors = [];

                if (req.body.newPassword.length < 5 || req.body.newPassword.length > 60) {
                    errors.push({ field: 'newPassword', message: 'Please enter a password between 5 and 60 characters.' });
                }

                if (errors.length) {
                    return res.status(400).json({ errors });
                }

                bcrypt.genSalt(10, (err, salt) => {
                    bcrypt.hash(req.body.newPassword, salt, (err, hash) => {
                        user.password = hash;
                        awesomeLog(req, `Changing PW - ${user.username}`);

                        if (req.body.newEmail) {
                            user.email = req.body.newEmail;
                            awesomeLog(req, `Changing Email - ${user.username}`);
                        }

                        db.users.save(user);
                        return res.status(200).json({ message: 'success' });
                    });
                });
            } else if (req.body.newEmail) {
                user.email = req.body.newEmail;
                awesomeLog(req, `Changing Email - ${user.username}`);
                db.users.save(user);
                return res.status(200).json({ message: 'success' });
            }
        })
        .catch((err) => {
            res.status(400).json({ errors: [{ field: 'currentPassword', message: 'Your current password is incorrect.' }] });
        });
}

router.post('/delete-account', (req, res) => {
    authenticateUser(req, res, deleteAccount);
});

function deleteAccount(req, res, user) {
    verifyPassword(user.username, req.body.password)
        .then((user) => {
            if (req.body.username !== user.username) {
                return Promise.reject(new Error('An error occurred, please try logging out and in again.'));
            }

            db.users.remove(user, true);

            return res.status(200).json({ message: 'success' });
        })
        .catch((err) => {
            res.status(400).json({ errors: [{ field: 'currentPassword', message: 'Your current password is incorrect.' }] });
        });
}

router.post('/imageUpload', (req, res) => {
    // authenticateUser(req, res, imageUpload);
    awesomeLog(req);
    imageUpload(req, res, {});
});

function imageUpload(req, res, user) {
    const form = new formidable.IncomingForm();
    form.parse(req, (err, fields, files) => {
        if (err) {
            awesomeLog(req, 'form parse error');
            return res.status(500).json({ message: 'An error occurred' });
        }
        if (!files || !files.image) {
            awesomeLog(req, 'No image in upload');
            return res.status(500).json({ message: 'An error occurred' });
        }

        const path = files.image.path;
        const imgurRequest = request.defaults({ json: true });
        fs.readFile(path, (e, img_data) => {
            const temp = { uri: 'https://api.imgur.com/3/image', headers: { Authorization: `Client-ID ${config.get('imgurClientID')}` } };
            temp.body = img_data.toString('base64');
            imgurRequest.post(temp, (e, r, body) => {
                if (e) {
                    awesomeLog(req, 'imgur post fail!');
                    awesomeLog(req, e);
                    awesomeLog(req, body);
                    return res.status(500).json({ message: 'An error occurred.' });
                } if (!body) {
                    awesomeLog(req, 'imgur post fail!!');
                    awesomeLog(req, e);
                    return res.status(500).json({ message: 'An error occurred.' });
                } if (r.statusCode !== 200 || body.error) {
                    awesomeLog(req, 'imgur post fail!!!');
                    awesomeLog(req, e);
                    awesomeLog(req, body);
                    return res.status(500).json({ message: 'An error occurred.' });
                }
                awesomeLog(req, body);
                return res.send(body);
            });
        });
    });
}

function authenticateUser(req, res, callback) {
    if (!req.cookies.lp && (!req.body.username || !req.body.password)) {
        return res.status(401).json({ message: 'Please log in.' });
    }
    if (req.body.username && req.body.password) {
        const username = req.body.username.toLowerCase().trim();
        const password = req.body.password;
        verifyPassword(username, password)
            .then((user) => {
                generateSession(req, res, user, callback);
            })
            .catch((err) => {
                console.log(err);
                if (err.code && err.message) {
                    awesomeLog(req, err.message);
                    res.status(err.code).json({ message: err.message });
                } else {
                    res.status(500).json({ message: 'An error occurred, please try again later.' });
                }
            });
    } else {
        db.users.find({ token: req.cookies.lp }, (err, users) => {
            if (err) {
                awesomeLog(req, `Error on authenticateUser else for:${req.body.username}, ${req.body.password}`);
                return res.status(500).json({ message: 'An error occurred, please try again later.' });
            } if (!users || !users.length) {
                awesomeLog(req, 'bad cookie!');
                return res.status(401).json({ message: 'Please log in again.' });
            }
            callback(req, res, users[0]);
        });
    }
}

function verifyPassword(username, password) {
    return new Promise((resolve, reject) => {
        db.users.find({ username }, (err, users) => {
            if (err) {
                return reject({ code: 500, message: 'An error occurred, please try again later.' });
            } if (!users || !users.length) {
                return reject({ code: 404, message: 'Invalid username and/or password.' });
            }

            const user = users[0];

            bcrypt.compare(password, user.password, (err, result) => {
                if (err) {
                    return reject({ code: 500, message: 'An error occurred, please try again later.' });
                }
                if (!result) {
                    const sha3password = CryptoJS.SHA3(password + username).toString(CryptoJS.enc.Base64);
                    bcrypt.compare(sha3password, user.password, (err, result) => {
                        if (err) {
                            reject({ code: 500, message: 'An error occurred, please try again later.' });
                        }
                        if (!result) {
                            /* TODO: reinstate this block after DB migration */
                            /* reject({code: 404, message: "Invalid username and/or password."}); */

                            /* TODO: remove this block after DB migration */
                            if (sha3password === user.password) {
                                resolve(user);
                            } else {
                                reject({ code: 404, message: 'Invalid username and/or password.' });
                            }
                        } else {
                            bcrypt.genSalt(10, (err, salt) => {
                                if (err) {
                                    return reject({ code: 500, message: 'An error occurred, please try again later.' });
                                }
                                bcrypt.hash(password, salt, (err, hash) => {
                                    if (err) {
                                        return reject({ code: 500, message: 'An error occurred, please try again later.' });
                                    }
                                    user.password = hash;
                                    db.users.save(user);
                                    resolve(user);
                                });
                            });
                        }
                    });
                } else {
                    resolve(user);
                }
            });
        });
    });
}

function generateSession(req, res, user, callback) {
    crypto.randomBytes(48, (ex, buf) => {
        const token = buf.toString('hex');
        user.token = token;
        db.users.save(user);
        res.cookie('lp', token, { path: '/', maxAge: 365 * 24 * 60 * 1000 });
        callback(req, res, user);
    });
}

module.exports = router;
