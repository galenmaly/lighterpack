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

const collections = ['users', 'libraries'];
const db = mongojs(config.get('databaseUrl'), collections);

const { authenticateModerator, verifyPassword } = require('./auth.js');

const moderatorList = config.get('moderators')

router.get('/moderation/search', (req, res) => {
    authenticateModerator(req, res, search);
});

function escapeRegExp(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
  }

function search(req, res) {
    let searchQuery = escapeRegExp(String(req.query.q).toLowerCase().trim());
    const nameSearch = new Promise((resolve, reject) => {
        db.users.find({ 'username': {'$regex': `${searchQuery}.*`, '$options': 'si'} }, (err, users) => {
            if (err) {
                return reject(err);
            }
            return resolve(users);
        });
    })

    const emailSearch = new Promise((resolve, reject) => {
        db.users.find({ 'email': {'$regex': `${searchQuery}.*`, '$options': 'si'} }, (err, users) => {
            if (err) {
                return reject(err);
            }
            return resolve(users);
        });
    })

    Promise.all([nameSearch, emailSearch])
    .then(([nameResult, emailResult]) => {
        const allResults = [].concat(nameResult).concat(emailResult)
        .map((user) => {
            return {
                username: user.username,
                library: user.library,
                email: user.email,
            }
        });

        res.json({results: allResults});
    })
    .catch((err) => {
        logWithRequest(req, err);
        res.status(500).json({message: err});
    })
    
}


router.post('/moderation/reset-password', (req, res) => {
    authenticateModerator(req, res, resetPassword);
});

function resetPassword(req, res, user) {
    let username = String(req.body.username).toLowerCase().trim();
    logWithRequest(req, {message: 'MODERATION Reset password start', username});

    db.users.find({ username }, (err, users) => {
        if (err) {
            logWithRequest(req, {message: 'MODERATION Reset password lookup error', username });
            return res.status(500).json({ message: 'An error occurred' });
        } if (!users.length) {
            logWithRequest(req, {message: 'MODERATION Reset password for unknown', username});
            return res.status(500).json({ message: 'An error occurred.' });
        }
        const user = users[0];
        require('crypto').randomBytes(12, (ex, buf) => {
            const newPassword = buf.toString('hex');

            bcrypt.genSalt(10, (err, salt) => {
                bcrypt.hash(newPassword, salt, (err, hash) => {
                    user.password = hash;
                    db.users.save(user);
                    const out = { newPassword };
                    logWithRequest(req, {message: 'MODERATION password changed', username});
                    return res.status(200).json(out);
                });
            });
        })
    });
}

router.post('/moderation/clear-session', (req, res) => {
    authenticateModerator(req, res, clearSession);
});

function clearSession(req, res, user) {
    let username = String(req.body.username).toLowerCase().trim();
    logWithRequest(req, {message: 'MODERATION Clear session start', username});

    db.users.find({ username }, (err, users) => {
        if (err) {
            logWithRequest(req, {message: 'MODERATION Clear session lookup error', username });
            return res.status(500).json({ message: 'An error occurred' });
        } if (!users.length) {
            logWithRequest(req, {message: 'MODERATION Clear session for unknown', username});
            return res.status(500).json({ message: 'An error occurred.' });
        }
        const user = users[0];
        user.token = "";
        db.users.save(user);
        logWithRequest(req, {message: 'MODERATION  Clear session succeeded', username});
        return res.status(200);
    });
}



module.exports = router;
