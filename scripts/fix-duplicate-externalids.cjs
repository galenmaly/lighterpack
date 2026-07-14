// Resolve duplicate share ids (externalIds) in the mongo database ahead of
// the postgres migration (list.external_id is UNIQUE there; mongo-to-postgres
// silently drops whichever duplicate inserts second).
//
// For each id held by more than one user (or listed twice by one user), the
// holder whose list the production share page currently renders keeps it —
// /r/:id resolves to the first matching user in natural (dump) order, so
// existing bookmarks keep showing the same list. Every other reference gets a
// freshly minted id written to that user's externalIds array and library
// lists. No accounts are deleted.
//
// Analysis runs entirely from a mongoexport dump — no db connection needed
// for a dry run. --live connects to mongo (run on the old server, from the
// old app root, while writes are blocked).
//
// Usage:
//   node scripts/fix-duplicate-externalids.cjs <users-dump.json> [--live]
//
// Writes <users-dump>.dup-externalids-report.json either way.

const fs = require('fs');
const zlib = require('zlib');
const crypto = require('crypto');
const readline = require('readline');

const ID_ALPHABET = '1234567890abcdefghijklmnopqrstuvwxyz';
const ID_LENGTH = 6;

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const flags = process.argv.slice(2).filter((a) => a.startsWith('--'));
if (args.length !== 1) {
    console.error('Usage: node scripts/fix-duplicate-externalids.cjs <users-dump.json> [--live]');
    process.exit(2);
}
const dumpPath = args[0];
const dryRun = flags.indexOf('--live') === -1;
console.log(`Dry run: ${dryRun}`);

function parseLibrary(user) {
    let lib = user.library;
    if (typeof lib === 'string') {
        lib = JSON.parse(lib);
    }
    if (!lib || typeof lib !== 'object') throw new Error('no library');
    return lib;
}


// A handful of ancient records contain a raw (unescaped) newline inside a
// string, splitting one JSON doc across dump lines. Rejoin fragments with an
// escaped \\n so the field content survives; a line that parses on its own
// always wins over a stale fragment.
let pendingFragment = '';
let droppedFragments = 0;
function parseDumpLine(line) {
    if (pendingFragment) {
        const joined = `${pendingFragment}\\n${line}`;
        try {
            const obj = JSON.parse(joined);
            pendingFragment = '';
            return obj;
        } catch (err) { /* fall through */ }
    }
    try {
        const obj = JSON.parse(line);
        if (pendingFragment) {
            droppedFragments++;
            console.log(`WARNING: dropped unparseable fragment (${pendingFragment.length} chars)`);
            pendingFragment = '';
        }
        return obj;
    } catch (err) {
        pendingFragment = pendingFragment ? `${pendingFragment}\\n${line}` : line;
        if (pendingFragment.length > 5 * 1024 * 1024) {
            droppedFragments++;
            console.log('WARNING: dropped unparseable fragment (>5MB)');
            pendingFragment = '';
        }
        return null;
    }
}

async function readDump() {
    // id -> array of holders in dump order:
    // { oid, username, inArray, listCount } (one holder per user per id)
    const holders = {};
    const allIds = new Set();
    const raw = fs.createReadStream(dumpPath);
    const rl = readline.createInterface({
        input: dumpPath.endsWith('.gz') ? raw.pipe(zlib.createGunzip()) : raw,
        crlfDelay: Infinity,
    });
    let i = 0;
    for await (const rawLine of rl) {
        if (!rawLine.trim()) continue;
        const user = parseDumpLine(rawLine);
        if (!user) continue;
        const oid = user._id && user._id.$oid;
        if (!oid) continue;

        const perUser = {};
        for (const raw of user.externalIds || []) {
            const id = String(raw).trim();
            if (!id) continue;
            if (!perUser[id]) perUser[id] = { inArray: false, listCount: 0 };
            perUser[id].inArray = true;
        }
        try {
            const lib = parseLibrary(user);
            for (const list of lib.lists || []) {
                if (!list || !list.externalId) continue;
                const id = String(list.externalId).trim();
                if (!id) continue;
                if (!perUser[id]) perUser[id] = { inArray: false, listCount: 0 };
                perUser[id].listCount++;
            }
        } catch (err) { /* unreadable library; externalIds array still counts */ }

        for (const id of Object.keys(perUser)) {
            allIds.add(id);
            if (!holders[id]) holders[id] = [];
            holders[id].push({
                oid,
                username: user.username,
                inArray: perUser[id].inArray,
                listCount: perUser[id].listCount,
            });
        }

        i++;
        if (i % 100000 === 0) console.log(`${i} users read...`);
    }
    if (pendingFragment) { droppedFragments++; console.log('WARNING: dump ended with unparseable fragment'); }
    if (droppedFragments) console.log(`WARNING: ${droppedFragments} fragment(s) dropped`);
    console.log(`${i} users read, ${allIds.size} distinct external ids.`);
    return { holders, allIds };
}

function mintId(allIds) {
    for (;;) {
        let id = '';
        for (let i = 0; i < ID_LENGTH; i++) {
            id += ID_ALPHABET[crypto.randomInt(ID_ALPHABET.length)];
        }
        if (!allIds.has(id)) {
            allIds.add(id);
            return id;
        }
    }
}

function planActions({ holders, allIds }) {
    // One action per (user, oldId) that must move to a fresh id:
    // { oid, username, oldId, newId, keepFirstList } — keepFirstList is set
    // on intra-user duplicates, where the first list keeps oldId and only
    // subsequent lists move.
    const actions = [];

    for (const id of Object.keys(holders)) {
        const hs = holders[id];
        const crossUser = hs.length > 1;
        const intraUser = hs.some((h) => h.listCount > 1);
        if (!crossUser && !intraUser) continue;

        // Production /r/:id renders the first user (natural order) whose
        // library lists contain the id; array-only holders never render.
        let winner = null;
        for (const h of hs) {
            if (h.listCount > 0) { winner = h; break; }
        }
        if (!winner) winner = hs[0];

        for (const h of hs) {
            if (h === winner) {
                if (h.listCount > 1) {
                    // Winner keeps the id on their first matching list only.
                    actions.push({
                        oid: h.oid, username: h.username, oldId: id, newId: mintId(allIds), keepFirstList: true,
                    });
                }
            } else {
                actions.push({
                    oid: h.oid, username: h.username, oldId: id, newId: mintId(allIds), keepFirstList: false,
                });
            }
        }
    }
    return actions;
}

// Replace oldId with newId in a live user doc. keepFirstList leaves the first
// matching list untouched (intra-user duplicates). Returns the fields to $set.
function rewriteUser(user, action) {
    const set = {};

    if (Array.isArray(user.externalIds)) {
        let replaced = false;
        const next = user.externalIds.map((raw) => {
            if (String(raw).trim() === action.oldId) {
                if (action.keepFirstList && !replaced) {
                    // Intra-user case: the array keeps the old id (still owned)
                    // and additionally records the new one.
                    replaced = true;
                    return raw;
                }
                replaced = true;
                return action.newId;
            }
            return raw;
        });
        if (action.keepFirstList) next.push(action.newId);
        set.externalIds = next;
    }

    const wasString = typeof user.library === 'string';
    let lib = null;
    try {
        lib = parseLibrary(user);
    } catch (err) {
        return set;
    }
    let seen = 0;
    let changed = false;
    for (const list of lib.lists || []) {
        if (!list || String(list.externalId || '').trim() !== action.oldId) continue;
        seen++;
        if (action.keepFirstList && seen === 1) continue;
        list.externalId = action.newId;
        changed = true;
    }
    if (changed) {
        if (wasString) set.library = JSON.stringify(lib);
        else set['library.lists'] = lib.lists;
    }
    return set;
}

async function applyLive(actions) {
    const config = require('config');
    const mongojs = require('mongojs');
    const db = mongojs(config.get('databaseUrl'), ['users']);
    const ObjectId = mongojs.ObjectId;

    function dbOp(fn) {
        return new Promise((resolve, reject) => {
            fn((err, result) => (err ? reject(err) : resolve(result)));
        });
    }

    for (const action of actions) {
        const _id = ObjectId(action.oid);
        const user = await dbOp((cb) => db.users.findOne({ _id }, cb));
        if (!user) {
            console.log(`SKIP ${action.oid} (${action.username}): not found in db`);
            action.skipped = true;
            continue;
        }
        const set = rewriteUser(user, action);
        if (!Object.keys(set).length) {
            console.log(`SKIP ${action.oid} (${action.username}): nothing to rewrite`);
            action.skipped = true;
            continue;
        }
        await dbOp((cb) => db.users.update({ _id }, { $set: set }, cb));
    }
    db.close();
}

readDump().then(async (data) => {
    const actions = planActions(data);

    for (const action of actions) {
        console.log(`${action.oldId} -> ${action.newId}  user "${action.username}" (${action.oid})${action.keepFirstList ? ' [intra-user duplicate: first list keeps old id]' : ''}`);
    }

    if (!dryRun && actions.length) {
        await applyLive(actions);
    }

    const reportPath = `${dumpPath}.dup-externalids-report.json`;
    fs.writeFileSync(reportPath, JSON.stringify({ dryRun, actions }, null, 2));
    console.log(`----\nDuplicate external ids requiring rewrites: ${actions.length}`);
    console.log(`Report: ${reportPath}`);
    if (dryRun && actions.length) console.log('Dry run only — re-run with --live to apply.');
}).catch((err) => {
    console.error(err);
    process.exit(1);
});
