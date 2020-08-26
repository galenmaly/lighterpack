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
const awesomeLog = require('./log.js');

const collections = ['users', 'libraries'];
const db = mongojs(config.get('databaseUrl'), collections);

const { authenticateModerator, verifyPassword } = require('./auth.js');

const moderatorList = config.get('moderators')

router.get('/moderation/search', (req, res) => {
    authenticateModerator(req, res, search);
});

function search(req, res) {
    let searchQuery = String(req.query.q).toLowerCase().trim();
    const nameSearch = new Promise((resolve, reject) => {
        db.users.find({ 'username': {'$regex': `^${searchQuery}.*`, '$options': 'si'} }, (err, users) => {
            if (err) {
                return reject(err);
            }
            return resolve(users);
        });
    })

    const emailSearch = new Promise((resolve, reject) => {
        db.users.find({ 'email': {'$regex': `/${searchQuery}/`, '$options': 'si'} }, (err, users) => {
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
        console.log(err);
        res.status(500).json({message: err});
    })
    
}


router.post('/moderation/reset-password', (req, res) => {
    authenticateModerator(req, res, resetPassword);
});

function resetPassword(req, res, user) {
    let username = String(req.body.username).toLowerCase().trim();
    console.log(username);

    db.users.find({ username }, (err, users) => {
        if (err) {
            awesomeLog(req, `MODERATION Reset password lookup error for:${username}`);
            return res.status(500).json({ message: 'An error occurred' });
        } if (!users.length) {
            awesomeLog(req, `MODERATION Reset password for unknown user:${username}`);
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
                    awesomeLog(req, `MODERATION password changed for user:${username}`);
                    return res.status(200).json(out);
                });
            });
        })
    });
}


module.exports = router;
