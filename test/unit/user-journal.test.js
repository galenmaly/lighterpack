import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { parseLine, namesUser, selectEntries, groupByRequest } from '../../scripts/user-journal.js';

// Shapes taken from the real logger: app.js writes the summary line at
// res.finish, logWithRequest writes the rest with the same requestid.
const SIGNIN_FAIL = {
    timestamp: '2026-08-06T10:00:01.000Z', requestid: 'r1',
    message: 'error on verifyPassword for: bob', error: 'Invalid credentials',
};
const SIGNIN_FAIL_SUMMARY = {
    timestamp: '2026-08-06T10:00:01.100Z', requestid: 'r1',
    method: 'POST', url: '/signin', status: 404, 'response-time': 92, 'remote-addr': '1.2.3.4',
};
const SAVE = {
    timestamp: '2026-08-06T10:05:00.000Z', requestid: 'r2',
    method: 'POST', url: '/saveLibrary', status: 200, username: 'bob', 'response-time': 40,
};
const BAD_COOKIE = { timestamp: '2026-08-06T10:05:00.000Z', requestid: 'r2', message: 'bad cookie!' };
const OTHER_USER = {
    timestamp: '2026-08-06T10:06:00.000Z', requestid: 'r3',
    method: 'POST', url: '/saveLibrary', status: 200, username: 'bobby',
};

describe('parseLine', () => {
    test('ignores the non-JSON noise journald mixes in', () => {
        assert.equal(parseLine('-- Logs begin at Mon 2026-08-06 --'), null);
        assert.equal(parseLine(''), null);
        assert.equal(parseLine('{not json'), null);
        assert.deepEqual(parseLine('{"message":"ok"}'), { message: 'ok' });
    });
});

describe('namesUser', () => {
    test('matches the username field exactly, not by prefix', () => {
        assert.equal(namesUser({ username: 'bob' }, 'bob'), true);
        assert.equal(namesUser({ username: 'BoB' }, 'bob'), true);
        assert.equal(namesUser({ username: 'bobby' }, 'bob'), false);
    });

    test('finds the failed-sign-in line, which has no username field', () => {
        assert.equal(namesUser(SIGNIN_FAIL, 'bob'), true);
        assert.equal(namesUser(SIGNIN_FAIL, 'bobby'), false);
    });

    test('matches the moderation and email-keyed fields', () => {
        assert.equal(namesUser({ requestedUsername: 'bob' }, 'bob'), true);
        assert.equal(namesUser({ initiatedby: 'galen' }, 'galen'), true);
        assert.equal(namesUser({ email: 'bob@example.com' }, 'bob@example.com'), true);
    });
});

describe('selectEntries', () => {
    test('pulls in sibling lines that never name the user', () => {
        // BAD_COOKIE carries no username; it is only reachable via r2.
        const entries = [SIGNIN_FAIL, SIGNIN_FAIL_SUMMARY, SAVE, BAD_COOKIE, OTHER_USER];
        const selected = selectEntries(entries, { user: 'bob' });

        assert.ok(selected.includes(BAD_COOKIE), 'sibling line should be pulled in by requestid');
        assert.ok(selected.includes(SIGNIN_FAIL_SUMMARY), 'summary line has no username on the signin path');
        assert.ok(!selected.includes(OTHER_USER), 'a different user must not leak in');
    });

    test('--request selects one request exactly', () => {
        const selected = selectEntries([SIGNIN_FAIL, SIGNIN_FAIL_SUMMARY, SAVE], { request: 'r1' });
        assert.deepEqual(selected.map((e) => e.requestid), ['r1', 'r1']);
    });

    test('orders by timestamp', () => {
        const selected = selectEntries([SAVE, BAD_COOKIE, SIGNIN_FAIL, SIGNIN_FAIL_SUMMARY], { user: 'bob' });
        const times = selected.map((e) => e.timestamp);
        assert.deepEqual(times, [...times].sort());
    });
});

describe('groupByRequest', () => {
    test('folds a request into one record with its messages', () => {
        const [record] = groupByRequest([SIGNIN_FAIL, SIGNIN_FAIL_SUMMARY]);

        assert.equal(record.url, '/signin');
        assert.equal(record.status, 404);
        assert.equal(record.ms, 92);
        assert.equal(record.messages.length, 1);
        assert.match(record.messages[0].message, /verifyPassword/);
    });

    test('keeps a request whose summary line never arrived', () => {
        // A crash mid-request logs the message but never reaches res.finish.
        const [record] = groupByRequest([BAD_COOKIE]);
        assert.equal(record.requestid, 'r2');
        assert.equal(record.status, undefined);
        assert.equal(record.messages.length, 1);
    });

    test('startup lines with no requestid survive as their own records', () => {
        const startup = { timestamp: '2026-08-06T09:00:00.000Z', message: 'Starting up Lighterpack...' };
        const records = groupByRequest([startup, SAVE]);
        assert.equal(records.length, 2);
        assert.equal(records[0].loose, true);
    });
});
