// Reconstruct what one account did, from the live server's journald logs.
//
//   ssh lighterpack "journalctl -u lighterpack --since '2 hours ago' -o cat" \
//     | node scripts/user-journal.js --user bob
//
//   node scripts/user-journal.js --user bob --file saved-journal.txt
//   node scripts/user-journal.js --match someone@example.com --since 2026-08-06T12:00
//   node scripts/user-journal.js --request 7f3c... # one request, every line
//
// Reads JSON log lines on stdin, so it needs no journal access of its own and
// can be pointed at a saved file just as well. For the historical archive from
// the old server, use log-user-timeline.js instead -- that one indexes 167GB of
// mixed formats; this one assumes the current JSON logger.
//
// Two passes, because matching on the username alone misses most of the story:
// only some lines carry one (server/auth.js sets req.lighterpackusername on the
// cookie path only, so a FAILED SIGN-IN has no username on its request line),
// and lines like 'bad cookie!' or 'Id generated' carry none at all. So pass 1
// collects the request ids a user touched and pass 2 pulls every line sharing
// those ids -- including the ones that never name them.

import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

// Fields that name a user across server/. `email` is included because the
// forgot-password and registration paths log by email, not username.
const USER_FIELDS = ['username', 'requestedUsername', 'initiatedby', 'email'];

/** Parse a log line; returns null for the non-JSON noise journald mixes in. */
function parseLine(line) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) return null;
    try {
        return JSON.parse(trimmed);
    } catch {
        return null;
    }
}

/** Does this entry name `needle` (case-insensitive, whole value or in the message)? */
function namesUser(entry, needle) {
    const wanted = needle.toLowerCase();
    for (const field of USER_FIELDS) {
        const value = entry[field];
        if (typeof value === 'string' && value.toLowerCase() === wanted) return true;
    }
    // 'error on verifyPassword for: bob' -- the only place a failed sign-in
    // names the account. Bounded so 'bob' doesn't match 'bobby'.
    const message = typeof entry.message === 'string' ? entry.message : '';
    return new RegExp(`(^|[^\\w-])${wanted.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\w-]|$)`, 'i').test(message);
}

/**
 * Select the entries belonging to a user: the ones that name them, plus every
 * other line sharing a request id with those.
 */
function selectEntries(entries, { user, match, request }) {
    const seeds = new Set();
    const direct = [];

    for (const entry of entries) {
        const hit = request ? entry.requestid === request
            : user ? namesUser(entry, user)
                : match ? JSON.stringify(entry).toLowerCase().includes(match.toLowerCase())
                    : false;
        if (!hit) continue;
        if (entry.requestid) seeds.add(entry.requestid);
        else direct.push(entry);
    }

    const selected = entries.filter((e) => e.requestid && seeds.has(e.requestid));
    return [...selected, ...direct].sort((a, b) => String(a.timestamp ?? '').localeCompare(String(b.timestamp ?? '')));
}

/**
 * Fold entries into one record per request: the summary line app.js writes at
 * res.finish carries method/url/status, the rest are messages logged along the
 * way. Entries without a request id become their own single-line records.
 */
function groupByRequest(entries) {
    const requests = new Map();
    const loose = [];

    for (const entry of entries) {
        if (!entry.requestid) { loose.push(entry); continue; }
        if (!requests.has(entry.requestid)) {
            requests.set(entry.requestid, { requestid: entry.requestid, messages: [] });
        }
        const record = requests.get(entry.requestid);
        // The summary line is the one carrying a status; everything else is a
        // message emitted while the request was in flight.
        if (entry.status !== undefined && entry.url !== undefined) {
            Object.assign(record, {
                timestamp: entry.timestamp, method: entry.method, url: entry.url,
                status: entry.status, ms: entry['response-time'], ip: entry['remote-addr'],
                agent: entry['user-agent'], username: entry.username ?? record.username,
            });
        } else {
            record.messages.push(entry);
            record.timestamp = record.timestamp ?? entry.timestamp;
            record.username = record.username ?? entry.username;
        }
    }

    const records = [...requests.values(), ...loose.map((e) => ({ ...e, messages: [], loose: true }))];
    return records.sort((a, b) => String(a.timestamp ?? '').localeCompare(String(b.timestamp ?? '')));
}

function inWindow(entry, since, until) {
    const ts = String(entry.timestamp ?? '');
    if (since && ts && ts < since) return false;
    if (until && ts && ts > until) return false;
    return true;
}

function formatRecord(record) {
    const time = String(record.timestamp ?? '').replace('T', ' ').replace(/\..*$/, '');
    if (record.loose) {
        return `${time}  ${record.message ?? JSON.stringify(record)}`;
    }

    const status = record.status ?? '---';
    const head = `${time}  ${String(status).padEnd(3)}  ${(record.method ?? '?').padEnd(4)} ${record.url ?? '?'}`
        + `${record.ms !== undefined ? `  ${record.ms}ms` : ''}${record.ip ? `  ${record.ip}` : ''}`;

    const detail = record.messages.map((m) => {
        const err = m.err?.message ?? m.error?.message ?? m.error;
        // `logWithRequest(req, err)` spreads an Error, whose `message` is not an
        // enumerable own property -- those lines arrive as bare {code}. Show
        // whatever fields they do carry rather than an empty bullet.
        const fields = Object.entries(m)
            .filter(([k]) => !['timestamp', 'requestid', 'message', 'err', 'error'].includes(k))
            .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`)
            .join(' ');
        const label = m.message ?? (fields || '(no message)');
        return `        ${label}${err ? ` -- ${typeof err === 'string' ? err : JSON.stringify(err)}` : ''}`;
    });
    return [head, ...detail].join('\n');
}

async function readLines(stream) {
    const lines = [];
    let buf = '';
    for await (const chunk of stream) {
        buf += chunk.toString('utf8');
        let nl;
        while ((nl = buf.indexOf('\n')) !== -1) {
            lines.push(buf.slice(0, nl));
            buf = buf.slice(nl + 1);
        }
    }
    if (buf) lines.push(buf);
    return lines;
}

async function main() {
    const argv = process.argv.slice(2);
    const flag = (name) => {
        const i = argv.indexOf(`--${name}`);
        if (i > -1) return argv[i + 1];
        const inline = argv.find((a) => a.startsWith(`--${name}=`));
        return inline ? inline.split('=').slice(1).join('=') : undefined;
    };

    const user = flag('user');
    const match = flag('match');
    const request = flag('request');
    const since = flag('since');
    const until = flag('until');
    const asJson = argv.includes('--json');

    if (!user && !match && !request) {
        console.error('Pass --user <username>, --match <string>, or --request <uuid>.');
        console.error("Example: ssh box \"journalctl -u lighterpack --since '2 hours ago' -o cat\" | node scripts/user-journal.js --user bob");
        process.exit(2);
    }

    const file = flag('file');
    const raw = await readLines(file ? fs.createReadStream(file) : process.stdin);

    // journald drops lines under load rather than blocking the service, and says
    // so in-band. Surface it: a gap here means the timeline below is incomplete,
    // not that nothing happened.
    const suppressed = raw.filter((l) => /Suppressed \d+ messages/.test(l));
    if (suppressed.length) {
        console.error(`WARNING: journald suppressed messages in this window (${suppressed.length} notices) -- the timeline is incomplete.`);
        console.error(`  ${suppressed[0].trim()}`);
    }

    const entries = raw.map(parseLine).filter(Boolean).filter((e) => inWindow(e, since, until));
    const selected = selectEntries(entries, { user, match, request });
    const records = groupByRequest(selected);

    if (asJson) {
        for (const record of records) console.log(JSON.stringify(record));
        return;
    }

    console.error(`${raw.length} lines in, ${entries.length} parsed, ${selected.length} matched -> ${records.length} requests\n`);
    for (const record of records) console.log(formatRecord(record));

    const byStatus = new Map();
    for (const record of records) {
        if (record.loose) continue;
        const key = `${record.status}`;
        byStatus.set(key, (byStatus.get(key) ?? 0) + 1);
    }
    if (byStatus.size) {
        console.log('\nBy status:');
        for (const [status, n] of [...byStatus.entries()].sort()) console.log(`  ${String(n).padStart(5)}  ${status}`);
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    await main();
}

export { parseLine, namesUser, selectEntries, groupByRequest };
