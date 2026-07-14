// Resolve duplicate usernames in the mongo database ahead of the postgres
// migration (users.username is UNIQUE there; mongo-to-postgres.js silently
// drops whichever duplicate inserts second).
//
// Duplicates are grouped by trimmed username. Within a group, the instance
// with the most items is always kept untouched. Every other instance is
// either deleted (clearly-abandoned: <= 10 items AND no share links) or
// renamed to <username><N>, optionally emailing the owner.
//
// Analysis runs entirely from a mongoexport dump — no db connection needed
// for a dry run, so it can be rehearsed anywhere. --live connects to mongo
// (run on the old server, from the old app root, while writes are blocked).
//
// Usage:
//   node scripts/fix-duplicate-usernames.cjs <users-dump.json> <user-dates.json> [--live] [--send-emails]
//
// Writes <users-dump>.dup-usernames-report.json either way.

const fs = require('fs');
const zlib = require('zlib');
const https = require('https');
const readline = require('readline');

const MAX_DELETABLE_ITEMS = 10;
const EMAIL_IF_SEEN_WITHIN_MS = 2 * 365 * 24 * 60 * 60 * 1000;

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const flags = process.argv.slice(2).filter((a) => a.startsWith('--'));
if (args.length !== 2) {
    console.error('Usage: node scripts/fix-duplicate-usernames.cjs <users-dump.json> <user-dates.json> [--live] [--send-emails]');
    process.exit(2);
}
const [dumpPath, userDatesPath] = args;
const dryRun = flags.indexOf('--live') === -1;
const sendEmails = flags.indexOf('--send-emails') !== -1;
console.log(`Dry run: ${dryRun}  Send emails: ${sendEmails}`);

const userDates = JSON.parse(fs.readFileSync(userDatesPath, 'utf-8'));

const emailTemplate = 'Hello ${originalUsername},\n\n'
    + 'While performing a system update we noticed you had two users registered '
    + 'with the same username due to a bug. We apologize for any inconvenience or '
    + 'frustration this may have caused in the past. One of your users has been '
    + 'renamed and your two users are now ${originalUsername} and ${newUsername}.\n\n'
    + 'You may have to reset your password to be able to log in again, which can be '
    + 'done at https://lighterpack.com/forgot-password\n\n'
    + 'Apologies for any inconvenience, and if you have any issues please reply to '
    + 'this email with details.\n\nThanks!\n\nThe LighterPack team';

// The library field has been stored as both an object and a JSON string over
// the years; items/lists may be missing on corrupt or ancient records.
function parseLibrary(user) {
    let lib = user.library;
    if (typeof lib === 'string') {
        lib = JSON.parse(lib);
    }
    if (!lib || typeof lib !== 'object') throw new Error('no library');
    return lib;
}

function externalIdCount(user, lib) {
    let count = (user.externalIds || []).length;
    const lists = (lib && lib.lists) || [];
    for (const list of lists) {
        if (list && list.externalId) count++;
    }
    return count;
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
    const byName = {};
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
        if (!user.username) continue;
        const key = String(user.username).trim();

        const instance = {
            oid: user._id && user._id.$oid,
            username: user.username,
            email: user.email || '',
            items: -1,
            itemsKnown: false,
            shareLinks: 0,
        };
        try {
            const lib = parseLibrary(user);
            instance.items = (lib.items || []).length;
            instance.itemsKnown = true;
            instance.shareLinks = externalIdCount(user, lib);
        } catch (err) {
            instance.shareLinks = (user.externalIds || []).length;
        }

        if (!byName[key]) byName[key] = [];
        byName[key].push(instance);

        i++;
        if (i % 100000 === 0) console.log(`${i} users read...`);
    }
    if (pendingFragment) { droppedFragments++; console.log('WARNING: dump ended with unparseable fragment'); }
    if (droppedFragments) console.log(`WARNING: ${droppedFragments} fragment(s) dropped`);
    console.log(`${i} users read.`);
    return byName;
}

function planActions(byName) {
    const takenNames = new Set(Object.keys(byName));
    const actions = [];

    function mintUsername(base) {
        let suffix = 1;
        while (takenNames.has(base + suffix)) suffix++;
        const name = base + suffix;
        takenNames.add(name);
        return name;
    }

    for (const key of Object.keys(byName)) {
        const instances = byName[key];
        if (instances.length < 2) continue;

        // Most items first; corrupt (unknown) libraries sort last and are
        // never deleted, only renamed.
        instances.sort((a, b) => b.items - a.items);
        const keeper = instances[0];
        const group = { username: key, keep: keeper, resolve: [] };

        for (const inst of instances.slice(1)) {
            const deletable = inst.itemsKnown
                && inst.items <= MAX_DELETABLE_ITEMS
                && inst.shareLinks === 0;
            if (deletable) {
                group.resolve.push({ action: 'delete', instance: inst });
            } else {
                const dates = userDates[key] || {};
                const lastSeen = dates.lastSeen ? new Date(dates.lastSeen) : null;
                const shouldEmail = sendEmails
                    && Boolean(inst.email)
                    && lastSeen !== null
                    && (Date.now() - lastSeen.getTime()) < EMAIL_IF_SEEN_WITHIN_MS;
                group.resolve.push({
                    action: 'rename',
                    instance: inst,
                    newUsername: mintUsername(key),
                    email: shouldEmail,
                });
            }
        }
        actions.push(group);
    }
    return actions;
}

function sendMail(to, originalUsername, newUsername) {
    const config = require('config');
    let text = emailTemplate;
    while (text.indexOf('${originalUsername}') !== -1) {
        text = text.replace('${originalUsername}', originalUsername);
    }
    text = text.replace('${newUsername}', newUsername);
    const body = new URLSearchParams({
        from: 'LighterPack <info@mg.lighterpack.com>',
        to,
        subject: 'LighterPack account update',
        text,
        'h:Reply-To': 'LighterPack <info@lighterpack.com>',
    }).toString();
    const auth = Buffer.from(`api:${config.get('mailgunAPIKey')}`).toString('base64');
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'api.mailgun.net',
            path: `/v3/${config.get('mailgunDomain')}/messages`,
            method: 'POST',
            headers: {
                Authorization: `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(body),
            },
        }, (res) => {
            if (res.statusCode >= 200 && res.statusCode < 300) resolve();
            else reject(new Error(`Mailgun error: ${res.statusCode}`));
            res.resume();
        });
        req.on('error', reject);
        req.end(body);
    });
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

    for (const group of actions) {
        for (const step of group.resolve) {
            const _id = ObjectId(step.instance.oid);
            if (step.action === 'delete') {
                await dbOp((cb) => db.users.remove({ _id }, true, cb));
            } else {
                await dbOp((cb) => db.users.update({ _id }, { $set: { username: step.newUsername } }, cb));
                if (step.email) {
                    try {
                        await sendMail(step.instance.email, group.username, step.newUsername);
                    } catch (err) {
                        console.log(`email failed for ${step.newUsername}: ${err.message}`);
                        step.emailFailed = true;
                    }
                }
            }
        }
    }
    db.close();
}

readDump().then(async (byName) => {
    const actions = planActions(byName);
    let deletes = 0;
    let renames = 0;
    let emails = 0;

    for (const group of actions) {
        console.log(`----\n"${group.username}": keeping ${group.keep.oid} (${group.keep.items} items)`);
        for (const step of group.resolve) {
            if (step.action === 'delete') {
                deletes++;
                console.log(`  delete ${step.instance.oid} (${step.instance.items} items, no share links)`);
            } else {
                renames++;
                if (step.email) emails++;
                console.log(`  rename ${step.instance.oid} -> "${step.newUsername}" (${step.instance.itemsKnown ? `${step.instance.items} items` : 'unreadable library'}, ${step.instance.shareLinks} share links)${step.email ? ' + email' : ''}`);
            }
        }
    }

    if (!dryRun && actions.length) {
        await applyLive(actions);
    }

    const reportPath = `${dumpPath}.dup-usernames-report.json`;
    fs.writeFileSync(reportPath, JSON.stringify({ dryRun, groups: actions }, null, 2));
    console.log(`----\nDuplicate username groups: ${actions.length} (${deletes} deletes, ${renames} renames, ${emails} emails)`);
    console.log(`Report: ${reportPath}`);
    if (dryRun && actions.length) console.log('Dry run only — re-run with --live to apply.');
}).catch((err) => {
    console.error(err);
    process.exit(1);
});
