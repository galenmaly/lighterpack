import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs';
import express from 'express';
import { customAlphabet } from 'nanoid';
import { promisify } from 'util';
import formidable from 'formidable';
import config from 'config';
import cloneDeep from 'lodash/cloneDeep.js';
import Knex from 'knex';
import { logWithRequest } from './log.js';
import { authenticateUser, verifyPassword, sessionCookieOptions } from './auth.js';
import { Library } from '../client/dataTypes.js';

const router = express.Router();

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

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
    return response.json();
}

const knex = Knex({
    client: 'pg',
    connection: cloneDeep(config.get('pgDatabase'))
});

const randomBytesAsync = promisify(crypto.randomBytes);


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
    } else if (!isValidEmail(email)) {
        errors.push({ field: 'email', message: 'Please enter a valid email.' });
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
            if (conflictingUsers.some((u) => u.username === username)) {
                logWithRequest(req, { message: 'User exists', username });
                return res.status(400).json({ errors: [{ field: 'username', message: 'That username already exists, please pick a different username.' }] });
            }
            if (conflictingUsers.some((u) => u.email === email)) {
                logWithRequest(req, { message: 'User email exists', email });
                return res.status(400).json({ errors: [{ field: 'email', message: 'A user with that email already exists.' }] });
            }
            logWithRequest(req, { message: 'User creation failed for unknown reason', conflictingUsers });
            return res.status(500).json({ errors: [{ message: 'An unexpected error occurred.' }] });
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
            registered: new Date(),
            last_seen: new Date()
        };

        logWithRequest(req, { message: 'Saving new user', username });

        try {
            await knex('users').insert(newUser);
            const out = { username, library: JSON.stringify(newUser.library), sync_token: newSyncToken };
            const opts = sessionCookieOptions();
            res.cookie('lp', token, opts);
            res.cookie('lp_loggedin', '1', { ...opts, httpOnly: false });
            return res.status(200).json(out);
        } catch (err) {
            if (err.code === '23505') {
                // lost a race against a concurrent registration for the same username/email
                logWithRequest(req, { message: 'Register unique violation race', username, email, err });
                return res.status(400).json({ errors: [{ message: 'That username or email already exists, please pick a different one.' }] });
            }
            logWithRequest(req, { message: 'Error inserting user', newUser, err });
            return res.status(500).json({ errors: [{ message: 'An error occurred when registering.' }] });
        }
    } catch (err) {
        logWithRequest(req, { message: 'Error searching for conflicting users', err });
        return res.status(500).json({ errors: [{ message: 'An error occurred.' }] });
    }
}

router.post('/signin', (req, res) => {
    authenticateUser(req, res, signin);
});

async function signin(req, res, user) {
    logWithRequest(req, { message: 'signed in', username: user.username });
    await knex('users')
        .where({ user_id: user.user_id })
        .update({
            last_seen: new Date()
        });
    return res.json({ username: user.username, library: JSON.stringify(user.library), sync_token: user.sync_token });
}

router.post('/saveLibrary', (req, res) => {
    authenticateUser(req, res, saveLibrary);
});

async function saveLibrary(req, res, user) {
    if (typeof req.body.sync_token === 'undefined') {
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
        logWithRequest(req, { message: 'Library parsing issue', username: user.username, err: e });
        return res.status(400).json({ errors: [{ message: 'An error occurred while saving your data - unable to parse library.' }] });
    }

    const newSyncToken = user.sync_token + 1;

    try {
        // Guard against a lost update from a concurrent save (e.g. two tabs):
        // only write if the stored sync_token still matches what we read.
        const updated = await knex('users')
            .where({ user_id: user.user_id, sync_token: user.sync_token })
            .update({
                library: library,
                sync_token: newSyncToken,
                last_seen: new Date()
            });

        if (!updated) {
            logWithRequest(req, { message: 'out of date syncToken (concurrent save)', username: user.username });
            return res.status(400).json({ message: 'Your list is out of date - please refresh your browser.' });
        }

        logWithRequest(req, { message: 'saved library', username: user.username });
        return res.status(200).json({ message: 'success', sync_token: newSyncToken });
    } catch (err) {
        logWithRequest(req, { message: 'Library saving error', username: user.username, err });
        return res.status(500).json({ errors: [{ message: 'An error occurred while saving your data.' }] });
    }
}

router.post('/externalId', (req, res) => {
    authenticateUser(req, res, externalId);
});

async function externalId(req, res, user) {
    const id = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 6)();
    logWithRequest(req, { message: 'Id generated', id });

    try {
        const lists = await knex('list').where({ external_id: id });

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
        const users = await knex('users').where({username});

        if (!users.length) {
            logWithRequest(req, { message: 'Forgot password for unknown user', username });
            return res.status(400).json({ message: 'An error occurred.' });
        }

        const user = users[0];

        const newPassword = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', 12)();
        const salt = await bcrypt.genSalt(10);
        const newPasswordHash = await bcrypt.hash(newPassword, salt);

        const email = user.email;

        const message = `Hello ${username},\n It looks like you forgot your password. Here's your new one: \n\n Username: ${username}\n Password: ${newPassword}\n\n If you continue to have problems, please reply to this email with details.\n\n Thanks!`;

        // Persist the new password before emailing it, so the password we send
        // is always the one that actually works. (Emailing first meant a failed
        // save left the user with a password that didn't match.)
        try {
            await knex('users').where({user_id: user.user_id}).update({
                password: newPasswordHash
            });
        } catch (err) {
            logWithRequest(req, { message: 'Error saving new password', err });
            return res.status(500).json({ message: 'An error occurred' });
        }

        logWithRequest(req, { message: 'Attempting to send new password', email });
        try {
            const mailgunResponse = await sendMail({
                from: 'LighterPack <info@mg.lighterpack.com>',
                to: email,
                replyTo: 'LighterPack <info@lighterpack.com>',
                subject: 'Your new LighterPack password',
                text: message,
            });
            logWithRequest(req, { message: 'Message sent', response: mailgunResponse.message });
        } catch (err) {
            logWithRequest(req, err);
            return res.status(500).json({ message: 'An error occurred' });
        }

        logWithRequest(req, { message: 'password changed for user', username });
        return res.status(200).json({ username });
    } catch (err) {
        logWithRequest(req, { message: 'Forgot password lookup error', username, err });
        return res.status(500).json({ message: 'An error occurred' });
    }
}

router.post('/forgotUsername', (req, res) => {
    forgotUsername(req, res);
});

async function forgotUsername(req, res) {
    logWithRequest(req);

    const email = String(req.body.email).toLowerCase().trim();

    if (!email || email.length < 1) {
        logWithRequest(req, { message: 'Bad forgot username', email });
        return res.status(400).json({ errors: [{ message: 'Please enter a valid email.' }] });
    }

    try {
        // Emails are stored as-typed, so match case-insensitively — otherwise a
        // user whose stored email has any uppercase letter can never recover it.
        const users = await knex('users').whereRaw('lower(email) = ?', [email]);

        if (!users.length) {
            logWithRequest(req, { message: 'Forgot email for unknown user', email });
            return res.status(400).json({ message: 'An error occurred' });
        }

        const user = users[0];
        const username = user.username;

        const message = `Hello ${username},\n It looks like you forgot your username. Here it is: \n\n Username: ${username}\n\n If you continue to have problems, please reply to this email with details.\n\n Thanks!`;

        logWithRequest(req, { message: 'Attempting to send username', email, username });
        try {
            const mailgunResponse = await sendMail({
                from: 'LighterPack <info@mg.lighterpack.com>',
                to: email,
                replyTo: 'LighterPack <info@lighterpack.com>',
                subject: 'Your LighterPack username',
                text: message,
            });
            logWithRequest(req, { message: 'Message sent', response: mailgunResponse.message });
        } catch (err) {
            logWithRequest(req, err);
            return res.status(500).json({ message: 'An error occurred' });
        }
        logWithRequest(req, { message: 'sent username message for user', username, email });
        return res.status(200).json({ email });
    } catch (err) {
        logWithRequest(req, { message: 'Forgot email lookup error', email, err });
        return res.status(500).json({ message: 'An error occurred' });
    }
}

router.post('/account', (req, res) => {
    authenticateUser(req, res, account);
});

async function account(req, res, user) {
    logWithRequest(req, { message: 'Starting account changes', username: user.username });

    try {
        await verifyPassword(user.username, String(req.body.currentPassword));
    } catch (err) {
        logWithRequest(req, { message: 'Account bad current password', username: user.username, err });
        if (err.code === 500) {
            return res.status(500).json({ errors: [{ message: err.message }] });
        }
        return res.status(400).json({ errors: [{ field: 'currentPassword', message: 'Your current password is incorrect.' }] });
    }

    try {
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

            if (!isValidEmail(email)) {
                return res.status(400).json({ errors: [{ field: 'email', message: 'Please enter a valid email.' }] });
            }

            let conflictingUsers = await knex('users')
                .where({ email })
                .whereNot({ user_id: user.user_id })
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
        logWithRequest(req, { message: 'Account update error', username: user.username, err });
        return res.status(500).json({ errors: [{ message: 'An error occurred while updating your account.' }] });
    }
}

router.post('/delete-account', (req, res) => {
    authenticateUser(req, res, deleteAccount);
});

async function deleteAccount(req, res, user) {
    logWithRequest(req, { message: 'Starting account delete', username: user.username });

    try {
        await verifyPassword(user.username, String(req.body.password));
    } catch (err) {
        logWithRequest(req, { message: 'Bad account deletion - invalid password', username: req.body.username, err });
        if (err.code === 500) {
            return res.status(500).json({ errors: [{ message: err.message }] });
        }
        return res.status(400).json({ errors: [{ field: 'currentPassword', message: 'Your current password is incorrect.' }] });
    }

    if (req.body.username !== user.username) {
        logWithRequest(req, { message: 'Bad account deletion - wrong user', requestedUsername: req.body.username, initiatedby: user.username });
        return res.status(400).json({ message: 'An error occurred, please try logging out and in again.' });
    }

    try {
        // list rows FK-reference the user, so they must go first (same transaction)
        await knex.transaction(async (trx) => {
            await trx('list').where({user_id: user.user_id}).del();
            await trx('users').where({user_id: user.user_id}).del();
        });

        logWithRequest(req, { message: 'Completed account delete', username: user.username });

        return res.status(200).json({ message: 'success' });
    } catch (err) {
        logWithRequest(req, { message: 'Account delete failed', username: user.username, err });
        res.status(500).json({ errors: [{ message: 'An error occurred, please try again later.' }] });
    }
}

router.post('/signout', async (req, res) => {
    if (req.cookies.lp) {
        try {
            await knex('users').where({token: String(req.cookies.lp)}).update({token: ''});
        } catch (err) {
            logWithRequest(req, { message: 'Error invalidating token on signout', err });
        }
    }
    const opts = sessionCookieOptions();
    res.clearCookie('lp', opts);
    res.clearCookie('lp_loggedin', { ...opts, httpOnly: false });
    return res.status(200).json({ message: 'success' });
});

router.post('/imageUpload', (req, res) => {
    imageUpload(req, res, {});
});

const maxImageUploadBytes = 5 * 1024 * 1024;

async function imageUpload(req, res, _user) {
    let files;
    try {
        [, files] = await formidable({ maxFileSize: maxImageUploadBytes }).parse(req);
    } catch (err) {
        logWithRequest(req, { message: 'form parse error', err });
        if (err.httpCode === 413) { // formidable flags an over-size upload with httpCode 413
            return res.status(413).json({ message: 'Image is too large (5MB max).' });
        }
        return res.status(500).json({ message: 'An error occurred' });
    }

    if (!files?.image?.[0]) {
        logWithRequest(req, { message: 'No image in upload' });
        return res.status(400).json({ message: 'No image provided.' });
    }

    const fd = new FormData();
    fd.append('image', new Blob([fs.readFileSync(files.image[0].filepath)]));
    fd.append('type', 'file');

    try {
        const r = await fetch('https://api.imgur.com/3/image', {
            method: 'POST',
            headers: { Authorization: `Client-ID ${config.get('imgurClientID')}` },
            body: fd,
        });
        const body = await r.text();
        if (!r.ok) {
            logWithRequest(req, { message: 'imgur post fail', status: r.status, body });
            return res.status(500).json({ message: 'An error occurred.' });
        }
        logWithRequest(req, { message: 'imgur post success', body });
        return res.send(body);
    } catch (err) {
        logWithRequest(req, { message: 'imgur post fail', err });
        return res.status(500).json({ message: 'An error occurred.' });
    }
}

export default router;
