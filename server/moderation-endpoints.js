import express from 'express';
import config from 'config';
import cloneDeep from 'lodash/cloneDeep.js';
import Knex from 'knex';
import { logWithRequest } from './log.js';
import { authenticateModerator, issueResetToken, resetPasswordUrl } from './auth.js';

const router = express.Router();

const knex = Knex({
    client: 'pg',
    connection: cloneDeep(config.get('pgDatabase'))
});

function escapeRegExp(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

async function search(req, res) {
    const searchQuery = escapeRegExp(String(req.query.q).trim());

    try {
        let userResults = await knex('users')
            .whereILike('username', `%${searchQuery}%`)
            .orWhereILike('email', `%${searchQuery}%`)
            .select('*');

        // One grouped count for the whole result set rather than a query per
        // user. Users with no lists simply don't appear in it.
        const listCounts = new Map();
        if (userResults.length) {
            const counts = await knex('list')
                .whereIn('user_id', userResults.map((user) => user.user_id))
                .groupBy('user_id')
                .select('user_id')
                .count({ lists: '*' });
            for (const row of counts) listCounts.set(row.user_id, Number(row.lists));
        }

        // Explicit field list, never select('*'): the row carries the password
        // hash and the session token.
        const bridgeUserResults = userResults
            .map((user) => ({
                username: user.username,
                library: user.library,
                email: user.email,
                registered: user.registered,
                lastSeen: user.last_seen,
                syncToken: user.sync_token,
                lists: listCounts.get(user.user_id) ?? 0,
            }));

        res.json({ results: bridgeUserResults });
    } catch (err) {
        logWithRequest(req, { message: 'moderation search error', err });
        res.status(500).json({ message: 'An error occurred.' });
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

        // Hand back a link rather than setting a password, and send no mail:
        // this endpoint exists for when mail delivery is the broken thing, so
        // the moderator relays the link however they can reach the user. Their
        // current password keeps working until they actually use it, which
        // matters because a relay that never lands would otherwise lock them
        // out of an account they could still get into. No cooldown here - the
        // moderator is acting precisely because the normal flow failed.
        const token = await issueResetToken(users[0]);

        logWithRequest(req, { message: 'MODERATION password reset link issued', username });
        return res.status(200).json({ resetUrl: resetPasswordUrl(token) });
    } catch (err) {
        logWithRequest(req, { message: 'MODERATION Reset password lookup error', username, err });
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

        logWithRequest(req, { message: 'MODERATION Clear session succeeded', username });
        return res.status(200).json({ message: 'success' });
    } catch (err) {
        logWithRequest(req, { message: 'MODERATION Clear session lookup error', username, err });
        return res.status(500).json({ message: 'An error occurred' });
    }
}

router.post('/moderation/clear-session', (req, res) => {
    authenticateModerator(req, res, clearSession);
});

export default router;
