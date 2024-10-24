const bcrypt = require('bcryptjs');
const express = require('express');

const router = express.Router();
const config = require('config');
const { logWithRequest } = require('./log.js');

const knex = require('knex')({
    client: 'pg',
    connection: config.util.cloneDeep(config.get('pgDatabase'))
});

const { authenticateModerator } = require('./auth.js');

function escapeRegExp(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

async function search(req, res) {
    const searchQuery = escapeRegExp(String(req.query.q).trim());

    try {
        let userResults = await knex('users')
            .whereILike({ username: `%${searchQuery}%` })
            .orWhereILike({ email: `%${searchQuery}%` })
            .select('*');

        const bridgeUserResults = userResults
            .map((user) => ({
                username: user.username,
                library: user.library,
                email: user.email,
            }));

        res.json({ results: bridgeUserResults });
    } catch (err) {
        logWithRequest(req, err);
        res.status(500).json({ message: err });
    }
}

router.get('/moderation/search', (req, res) => {
    authenticateModerator(req, res, search);
});

async function resetPassword(req, res) {
    const username = String(req.body.username).toLowerCase().trim();
    logWithRequest(req, { message: 'MODERATION Reset password start', username });

    try {
        const users = await knex('users').select().where({username});

        if (!users.length) {
            logWithRequest(req, { message: 'MODERATION Reset password for unknown', username });
            return res.status(500).json({ message: 'An error occurred.' });
        }

        const newPassword = generate('1234567890abcdefghijklmnopqrstuvwxyz', 20);

        const salt = await bcrypt.genSalt(10);
        const newPasswordHash = await bcrypt.hash(newPassword, salt);
       
        await knex('users').where({username}).update({
            password: newPasswordHash
        });
                   
        logWithRequest(req, { message: 'MODERATION password changed', username });
        return res.status(200).json({ newPassword });
    } catch (err) {        
        logWithRequest(req, { message: 'MODERATION Reset password lookup error', username });
        return res.status(500).json({ message: 'An error occurred' });
    }
}

router.post('/moderation/reset-password', (req, res) => {
    authenticateModerator(req, res, resetPassword);
});

async function clearSession(req, res) {
    const username = String(req.body.username).toLowerCase().trim();
    logWithRequest(req, { message: 'MODERATION Clear session start', username });

    try {
        const users = await knex('users').select().where({username});
        
        if (!users.length) {
            logWithRequest(req, { message: 'MODERATION Clear session for unknown', username });
            return res.status(500).json({ message: 'An error occurred.' });
        }

        await knex('users').where({username}).update({
            token: ''
        });

        logWithRequest(req, { message: 'MODERATION  Clear session succeeded', username });
        return res.status(200);
    } catch (err) {
        logWithRequest(req, { message: 'MODERATION Clear session lookup error', username });
        return res.status(500).json({ message: 'An error occurred' });
    }
}

router.post('/moderation/clear-session', (req, res) => {
    authenticateModerator(req, res, clearSession);
});

module.exports = router;
