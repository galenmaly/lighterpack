// Layer 2 validation gate for the mongo -> postgres migration.
//
// Layer 1 (compare-datatypes-formats.mjs) proves the 0.4 upgrade computes the
// same numbers as master. It never touches a database, so it cannot prove the
// right rows actually landed in postgres. This covers that gap.
//
// Three modes, cheapest and most complete first:
//
//   --mode data    (default) Every user in the dump, compared against what is
//                  stored in postgres. No HTTP at all -- the dump is streamed
//                  and postgres is read in batches. This is the mode that gives
//                  full coverage, and it is the one to gate on.
//
//   --mode render  A sample of lists fetched from the LOCAL new server and
//                  compared against the dump. This is what exercises
//                  server/views.js and the real render path. Sampled because
//                  rendering is the same code for every list -- once it is
//                  right it is right.
//
//   --mode prod    A small sample compared against live production, as a
//                  belt-and-braces check against the actually-served old
//                  stack. Rate limited, because production is a live site.
//
// Usage:
//   node scripts/verify-migration.js --dump logs/users-2026-07-14.json.gz
//   node scripts/verify-migration.js --mode render --dump <dump> --limit 2000
//   node scripts/verify-migration.js --mode prod --limit 500
//
// Diffs are bucketed by pattern, so a systemic problem reads as a few lines
// with sample usernames rather than 300k rows. Progress is checkpointed, so
// ctrl-C and rerun is safe.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import readline from 'node:readline';
import http from 'node:http';
import https from 'node:https';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
    const i = args.indexOf(`--${name}`);
    return i === -1 ? fallback : args[i + 1];
};
const has = (name) => args.includes(`--${name}`);

const USAGE = `Usage: node scripts/verify-migration.js [options]

  --mode data|render|prod   what to compare (default: data)
  --dump PATH               dump file, .json or .json.gz (data and render modes)
  --limit N                 sample size for render/prod (default 2000 / 500)
  --all                     no sampling -- every list (render mode)
  --new-base-url URL        new stack (default http://localhost:3000)
  --old-base-url URL        production, prod mode only (default https://lighterpack.com)
  --old-host HOST           Host header for the old stack, so you can point
                            --old-base-url at a restored-backup box by IP
                            without giving it public DNS
  --new-host HOST           same, for --new-base-url. Setting either also skips
                            TLS name verification, since a clone reached by IP
                            presents a cert for the real hostname.
  --no-ownership-check      render mode: do not look up list ownership in
                            postgres first. Required when the box being
                            rendered is not backed by the postgres in your
                            config -- e.g. pointing render mode at the old
                            stack to check the old renderer against the dump.
  --rps N                   max requests/sec against the old stack (default 5).
                            0 means no limit -- only for a clone nobody is
                            using; it also lifts the prod concurrency cap.
  --concurrency N           parallel requests against the new server (default 24)
  --batch N                 users per postgres round trip, data mode (default 200)
  --ledger PATH             progress file (default logs/verify-migration-ledger.json)
  --reset                   ignore any existing ledger and start over
`;

const MODE = flag('mode', 'data');
const DUMP = flag('dump', null);
const NEW_BASE = (flag('new-base-url', 'http://localhost:3000')).replace(/\/$/, '');
const OLD_BASE = (flag('old-base-url', 'https://lighterpack.com')).replace(/\/$/, '');
const OLD_HOST = flag('old-host', null);
const NEW_HOST = flag('new-host', null);
const RPS = parseFloat(flag('rps', '5'));
const THROTTLED = RPS > 0;
const CONCURRENCY = parseInt(flag('concurrency', '24'), 10);
const BATCH = parseInt(flag('batch', '200'), 10);
const LEDGER_PATH = flag('ledger', 'logs/verify-migration-ledger.json');
const LIMIT = has('all') ? Infinity : parseInt(flag('limit', MODE === 'prod' ? '500' : '2000'), 10);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- diff bucketing --------------------------------------------------------

const buckets = new Map();
const noteBucket = (pattern, id) => {
    let b = buckets.get(pattern);
    if (!b) { b = { count: 0, samples: [] }; buckets.set(pattern, b); }
    b.count += 1;
    if (b.samples.length < 10) b.samples.push(id);
};

const summary = () => Object.fromEntries([...buckets].sort((a, b) => b[1].count - a[1].count));

// --- semantic snapshot -----------------------------------------------------

// Everything a share page is allowed to say about a list, computed straight
// from dataTypes. Compared as exact values: both sides run the same summation
// over what is meant to be the same data, so anything other than an exact
// match is worth a look.
function snapshotList(listToCsv, library, list) {
    list.calculateTotals();
    return {
        csv: listToCsv(library, list),
        totals: [
            list.totalWeight, list.totalWornWeight, list.totalConsumableWeight,
            list.totalBaseWeight, list.totalPackWeight,
            list.totalPrice, list.totalConsumablePrice, list.totalQty,
        ].join('|'),
        subtotals: (list.categoryIds || []).map((cid) => {
            const c = library.getCategoryById(cid);
            if (!c) return `${cid}:missing`;
            return [c.id, c.name, c.subtotalWeight, c.subtotalPrice, c.subtotalQty].join(':');
        }).join('|'),
    };
}

function compareSnapshots(a, b, report) {
    if (a.csv !== b.csv) report('items');
    if (a.totals !== b.totals) report('totals');
    if (a.subtotals !== b.subtotals) report('subtotals');
}

// Snapshot every shared list in a serialized library. Returns a map keyed by
// externalId, or null if the library will not load at all.
function snapshotLibrary(Library, listToCsv, serialized) {
    const library = new Library();
    library.load(serialized);
    const out = new Map();
    for (const list of library.lists) {
        if (!list.externalId) continue;
        library.defaultListId = list.id;
        out.set(list.externalId, snapshotList(listToCsv, library, list));
    }
    return out;
}

// --- dump streaming --------------------------------------------------------

function dumpLines(dumpPath) {
    const raw = fs.createReadStream(dumpPath);
    const stream = dumpPath.endsWith('.gz') ? raw.pipe(zlib.createGunzip()) : raw;
    return readline.createInterface({ input: stream, crlfDelay: Infinity });
}

// 22 records in the 2026-07-14 dump contain a raw newline inside a string, so
// mongoexport wrote them across several physical lines. Reading line-by-line
// silently loses those users -- the same bug that killed the importer. Rejoin
// with an escaped newline (a literal one is not legal inside a JSON string)
// until the record parses. Yields {user} or {broken} for anything that never
// does, so callers can bucket it rather than drop it quietly.
async function* dumpUsers(dumpPath) {
    let pending = null;
    for await (const line of dumpLines(dumpPath)) {
        let user = null;
        try { user = JSON.parse(line); } catch { /* fragment or start of one */ }

        if (user && pending !== null) {
            yield { broken: pending.slice(0, 120) };
            pending = null;
        } else if (!user) {
            if (!line.trim() && pending === null) continue;
            pending = pending === null ? line : `${pending}\\n${line}`;
            try { user = JSON.parse(pending); } catch { continue; }
            pending = null;
        }
        yield { user };
    }
    if (pending !== null) yield { broken: pending.slice(0, 120) };
}

// --- HTTP ------------------------------------------------------------------

let nextSlot = 0;
async function throttle() {
    const interval = 1000 / RPS;
    const now = Date.now();
    const slot = Math.max(now, nextSlot);
    nextSlot = slot + interval;
    if (slot > now) await sleep(slot - now);
}

// fetch() silently drops a Host header -- it is a forbidden header name -- so a
// Host override has to go through node:http, which honours it. Only used when
// --old-host is set, i.e. when pointing at a clone by IP.
function httpGetWithHost(url, host) {
    return new Promise((resolve, reject) => {
        const target = new URL(url);
        const lib = target.protocol === 'https:' ? https : http;
        const req = lib.request({
            protocol: target.protocol,
            hostname: target.hostname,
            port: target.port || (target.protocol === 'https:' ? 443 : 80),
            path: `${target.pathname}${target.search}`,
            headers: { 'User-Agent': 'lighterpack-migration-check', Host: host },
            // The clone's cert, if any, is issued for the real hostname and we
            // are connecting by IP, so the name will not match.
            ...(target.protocol === 'https:' ? { servername: host, rejectUnauthorized: false } : {}),
            timeout: 30000,
        }, (res) => {
            let body = '';
            res.setEncoding('utf8');
            res.on('data', (c) => { body += c; });
            res.on('end', () => resolve({ status: res.statusCode, body }));
        });
        req.on('timeout', () => req.destroy(new Error('timeout')));
        req.on('error', reject);
        req.end();
    });
}

// Counted per target so progress can show what each box is actually taking,
// rather than one blended number.
const reqCounts = { old: 0, new: 0 };

const fmtDuration = (seconds) => {
    if (!Number.isFinite(seconds) || seconds < 0) return '--:--';
    const s = Math.round(seconds);
    const m = Math.floor((s % 3600) / 60);
    const rem = String(s % 60).padStart(2, '0');
    if (s >= 3600) return `${Math.floor(s / 3600)}:${String(m).padStart(2, '0')}:${rem}`;
    return `${m}:${rem}`;
};

// Prints at most every 2s (and always on the final item), so the cadence is the
// same whether you are checking 500 lists or 400,000.
function progressReporter({ showOld }) {
    const t0 = Date.now();
    const base = { old: reqCounts.old, new: reqCounts.new };
    let lastPrint = 0;
    return (done, total) => {
        const now = Date.now();
        if (done < total && now - lastPrint < 2000) return;
        lastPrint = now;
        const elapsed = (now - t0) / 1000;
        const rate = elapsed > 0 ? done / elapsed : 0;
        const eta = rate > 0 ? (total - done) / rate : Infinity;
        const rps = (key) => (elapsed > 0 ? ((reqCounts[key] - base[key]) / elapsed).toFixed(1) : '0.0');
        const boxes = showOld ? `old ${rps('old')}/s  new ${rps('new')}/s` : `new ${rps('new')}/s`;
        const pct = total > 0 ? ((done / total) * 100).toFixed(1) : '0.0';
        process.stderr.write(`  ${done}/${total} (${pct}%)  ${boxes}  elapsed ${fmtDuration(elapsed)}  eta ${fmtDuration(eta)}\n`);
    };
}

async function fetchText(url, { rateLimited = false, host = null } = {}) {
    if (url.startsWith(OLD_BASE)) reqCounts.old += 1; else reqCounts.new += 1;
    if (rateLimited && THROTTLED) await throttle();
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            if (host) return await httpGetWithHost(url, host);
            const res = await fetch(url, {
                headers: { 'User-Agent': 'lighterpack-migration-check' },
                signal: AbortSignal.timeout(30000),
            });
            return { status: res.status, body: await res.text() };
        } catch (err) {
            if (attempt === 2) return { status: 0, body: '', error: err.message };
            await sleep(500 * (attempt + 1));
        }
    }
    return { status: 0, body: '' };
}

// --- CSV -------------------------------------------------------------------

// Tolerant of both dialects. The postgres branch emits strict RFC4180; master
// only quotes fields containing a comma, so it can emit a bare field with
// stray quotes in it. Quoted parsing falls back to raw when the closing quote
// is not followed by a delimiter, so both shapes parse to the same value.
function parseCsv(text) {
    const rows = [];
    let row = [];
    let i = 0;
    const n = text.length;

    while (i < n) {
        let field;

        if (text[i] === '"') {
            const start = i;
            let out = '';
            let j = i + 1;
            let closed = false;
            while (j < n) {
                if (text[j] === '"') {
                    if (text[j + 1] === '"') { out += '"'; j += 2; continue; }
                    j += 1; closed = true; break;
                }
                out += text[j]; j += 1;
            }
            const next = text[j];
            if (closed && (next === undefined || next === ',' || next === '\n' || next === '\r')) {
                field = out;
                i = j;
            } else {
                let k = start;
                let raw = '';
                while (k < n && text[k] !== ',' && text[k] !== '\n' && text[k] !== '\r') { raw += text[k]; k += 1; }
                field = raw;
                i = k;
            }
        } else {
            let raw = '';
            while (i < n && text[i] !== ',' && text[i] !== '\n' && text[i] !== '\r') { raw += text[i]; i += 1; }
            field = raw;
        }

        row.push(field);

        if (i < n && text[i] === ',') { i += 1; continue; }
        if (i < n && (text[i] === '\n' || text[i] === '\r')) {
            if (text[i] === '\r' && text[i + 1] === '\n') i += 1;
            i += 1;
            rows.push(row);
            row = [];
        }
    }
    if (row.length && !(row.length === 1 && row[0] === '')) rows.push(row);
    return rows;
}

const CSV_COLUMNS = ['name', 'category', 'description', 'qty', 'weight', 'unit', 'url', 'price', 'worn', 'consumable'];
const normField = (s) => (s ?? '').replace(/\r/g, '').trim();

function compareCsv(expectedText, actualText, report) {
    const expected = parseCsv(expectedText).slice(1);
    const actual = parseCsv(actualText).slice(1);

    if (expected.length !== actual.length) {
        report('csv:row-count');
        return;
    }
    for (let r = 0; r < expected.length; r++) {
        for (let c = 0; c < CSV_COLUMNS.length; c++) {
            if (normField(expected[r][c]) !== normField(actual[r][c])) report(`csv:${CSV_COLUMNS[c]}`);
        }
    }
}

// --- rendered totals -------------------------------------------------------

const stripTags = (s) => s.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

// Subtotals render as raw floats (mg="1939105.7999999998"), not integers.
const MG_RE = /mg="(-?[\d.]+(?:[eE][+-]?\d+)?)"/;

// templates/t_totals.mustache, byte-identical on master and this branch.
function extractTotals(html) {
    const out = { categories: [], breakdown: {}, total: null, totalQty: null, totalPrice: null };

    const catRe = /<li class="lpTotalCategory lpRow" id="total_(\d+)"[^>]*>([\s\S]*?)<\/li>/g;
    let m;
    while ((m = catRe.exec(html)) !== null) {
        const [, id, inner] = m;
        const mg = MG_RE.exec(inner);
        // Cells are [legend, name, price?, weight] -- the price cell only
        // renders when the list has prices switched on.
        const cells = [...inner.matchAll(/<span class="lpCell[^"]*">([\s\S]*?)<\/span>/g)].map((c) => stripTags(c[1]));
        out.categories.push({
            id,
            name: cells[1] ?? '',
            mg: mg ? mg[1] : null,
            price: cells.length >= 4 ? cells[2] : null,
        });
    }

    const bdRe = /data-weight-type="(consumable|worn|base)"([\s\S]*?)<\/li>/g;
    while ((m = bdRe.exec(html)) !== null) {
        const mg = MG_RE.exec(m[2]);
        out.breakdown[m[1]] = mg ? mg[1] : null;
    }

    const totalVal = /<span class="lpTotalValue" title="(\d+) items">([\s\S]*?)<\/span>/.exec(html);
    if (totalVal) {
        out.totalQty = totalVal[1];
        out.total = stripTags(totalVal[2]);
    }
    const totalPrice = /<span class="lpCell lpNumber lpSubtotal items">([\s\S]*?)<\/span>/.exec(html);
    if (totalPrice) out.totalPrice = stripTags(totalPrice[1]);

    return out;
}

// Raw mg attributes are floating-point sums. The two stacks accumulate them
// from inputs that are numerically equal but differently encoded -- mongo's
// stored 0.3 library versus the re-encoded 0.4 one -- so the last bit can
// differ: 635028.8 against 635028.7999999999. That is 1e-8 mg, about ten
// picograms, and the displayed value either side is byte-identical. Comparing
// these as strings turned ~98k lists into false positives on the first full
// run. Compare numerically, with a relative tolerance far tighter than
// anything that could reach a rendered page.
const NEAR = 1e-9;
const mgEqual = (a, b) => {
    if (a === b) return true;
    if (a === null || b === null || a === undefined || b === undefined) return false;
    const x = Number(a);
    const y = Number(b);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    return Math.abs(x - y) <= Math.max(Math.abs(x), Math.abs(y), 1) * NEAR;
};

function compareTotals(oldHtml, newHtml, report) {
    const a = extractTotals(oldHtml);
    const b = extractTotals(newHtml);

    if (a.categories.length !== b.categories.length) {
        report('totals:category-count');
    } else {
        for (let i = 0; i < a.categories.length; i++) {
            for (const key of ['id', 'name', 'price']) {
                if (a.categories[i][key] !== b.categories[i][key]) report(`totals:category-${key}`);
            }
            if (!mgEqual(a.categories[i].mg, b.categories[i].mg)) report('totals:category-mg');
        }
    }
    for (const key of ['consumable', 'worn', 'base']) {
        if (!mgEqual(a.breakdown[key] ?? null, b.breakdown[key] ?? null)) report(`totals:${key}-weight`);
    }
    if (a.total !== b.total) report('totals:list-total');
    if (a.totalQty !== b.totalQty) report('totals:total-qty');
    if (a.totalPrice !== b.totalPrice) report('totals:total-price');
}

// Compare a rendered page against a snapshot computed from the dump. The
// snapshot carries exact floats; the page carries the same floats in mg
// attributes, so they compare directly.
function compareRenderToSnapshot(snapshot, html, report) {
    const rendered = extractTotals(html);
    const expected = snapshot.subtotals ? snapshot.subtotals.split('|').filter(Boolean) : [];

    if (expected.length !== rendered.categories.length) {
        report('render:category-count');
        return;
    }
    for (let i = 0; i < expected.length; i++) {
        const [id, ...rest] = expected[i].split(':');
        const weight = rest[rest.length - 3];
        if (rendered.categories[i].id !== id) report('render:category-id');
        if (!mgEqual(rendered.categories[i].mg, weight)) report('render:category-weight');
    }
}

// --- rendered list description ---------------------------------------------

// Master renders descriptions with markdown@0.5; this branch uses the hardened
// marked wrapper in client/utils/markdown.js. The two engines emit different
// markup for identical input, so comparing HTML would be all noise. Compare the
// visible text instead: that ignores engine formatting but still catches a
// description whose content was lost or reinterpreted.
//
// Both templates wrap it in <div id="lpListDescription">, and the categories
// list always follows, which is a safer right edge than matching </div> when a
// description can itself contain divs.
function extractDescription(html) {
    const m = /<div id="lpListDescription">([\s\S]*?)<ul class="lpCategories">/.exec(html);
    if (!m) return null;
    return m[1].replace(/<\/div>\s*$/, '');
}

// Tags are stripped before entities are decoded, deliberately. The new renderer
// escapes block-level HTML so it shows up as literal text; master's markdown
// could emit it as real markup. Stripping first means the escaped version
// survives as text and the live version does not, so "shown as source" vs
// "interpreted as markup" reads as a difference rather than cancelling out.
function descriptionText(html) {
    return html
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#(?:39|x27);/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim();
}

function compareDescription(oldHtml, newHtml, report) {
    const oldDesc = extractDescription(oldHtml);
    const newDesc = extractDescription(newHtml);
    if (oldDesc === null && newDesc === null) return;
    if (oldDesc === null) { report('desc:only-on-new'); return; }
    if (newDesc === null) { report('desc:only-on-old'); return; }

    const oldText = descriptionText(oldDesc);
    const newText = descriptionText(newDesc);
    if (oldText === newText) return;
    // Losing text outright is worse than rendering it differently.
    report(newText.length < oldText.length ? 'desc:text-shorter' : 'desc:text-changed');
}

export {
    parseCsv, compareCsv, extractTotals, compareTotals, mgEqual,
    snapshotList, snapshotLibrary, compareSnapshots,
    extractDescription, descriptionText, compareDescription,
};

// --- modes -----------------------------------------------------------------

async function loadAppModules() {
    const [{ Library }, csv, { default: config }, { default: cloneDeep }, { default: Knex }] = await Promise.all([
        import('../client/dataTypes.js'),
        import('../server/csv.js'),
        import('config'),
        import('lodash/cloneDeep.js'),
        import('knex'),
    ]);
    const knex = Knex({ client: 'pg', connection: cloneDeep(config.get('pgDatabase')) });
    return { Library, listToCsv: csv.listToCsv, knex };
}

// Every user in the dump vs what postgres actually stores. No HTTP.
async function modeData() {
    if (!DUMP) throw new Error('--dump is required for data mode');
    const { Library, listToCsv, knex } = await loadAppModules();

    let users = 0;
    let matched = 0;
    let cleanLists = 0;
    let comparedLists = 0;

    async function processBatch(batch) {
        const rows = await knex('users')
            .whereIn('username', batch.map((b) => b.username))
            .select('username', 'library');
        const stored = new Map(rows.map((r) => [r.username, r.library]));

        for (const { username, library } of batch) {
            const pg = stored.get(username);
            if (pg === undefined) { noteBucket('user:not-in-postgres', username); continue; }
            matched += 1;

            let expected;
            let actual;
            try {
                expected = snapshotLibrary(Library, listToCsv, library);
            } catch (err) {
                // Already broken in the dump; the importer stores these raw.
                noteBucket(`dump:load-failed (${err.code ?? 'error'})`, username);
                continue;
            }
            try {
                actual = snapshotLibrary(Library, listToCsv, pg);
            } catch (err) {
                noteBucket(`postgres:load-failed (${err.code ?? 'error'})`, username);
                continue;
            }

            for (const [externalId, exp] of expected) {
                comparedLists += 1;
                const act = actual.get(externalId);
                if (!act) { noteBucket('list:missing-in-postgres', `${username}/${externalId}`); continue; }
                const seen = new Set();
                compareSnapshots(exp, act, (p) => {
                    if (seen.has(p)) return;
                    seen.add(p);
                    noteBucket(`data:${p}`, `${username}/${externalId}`);
                });
                if (seen.size === 0) cleanLists += 1;
            }
            for (const externalId of actual.keys()) {
                if (!expected.has(externalId)) noteBucket('list:extra-in-postgres', `${username}/${externalId}`);
            }
        }
    }

    let batch = [];
    for await (const rec of dumpUsers(DUMP)) {
        if (rec.broken) { noteBucket('dump:unparseable-record', rec.broken.slice(0, 60)); continue; }
        const user = rec.user;
        users += 1;
        if (!user.username || !user.library) { noteBucket('dump:no-library', user.username ?? '(unnamed)'); continue; }
        batch.push({ username: user.username, library: user.library });

        if (batch.length >= BATCH) {
            await processBatch(batch);
            batch = [];
            if (users % 10000 < BATCH) {
                process.stderr.write(`  ${users} users, ${comparedLists} lists, ${buckets.size} diff patterns\n`);
            }
        }
    }
    if (batch.length) await processBatch(batch);

    await knex.destroy();
    console.log(JSON.stringify({
        mode: 'data',
        usersInDump: users,
        usersMatchedInPostgres: matched,
        listsCompared: comparedLists,
        listsIdentical: cleanLists,
        diffBuckets: summary(),
    }, null, 2));
    return buckets.size === 0 ? 0 : 1;
}

async function runPool(items, worker, concurrency, onTick) {
    let idx = 0;
    let done = 0;
    await Promise.all(Array.from({ length: concurrency }, async () => {
        for (;;) {
            const i = idx++;
            if (i >= items.length) return;
            await worker(items[i]);
            done += 1;
            if (onTick) onTick(done, items.length);
        }
    }));
}

// A sample of lists rendered by the local new server, checked against the dump.
async function modeRender() {
    if (!DUMP) throw new Error('--dump is required for render mode');
    const { Library, listToCsv, knex } = await loadAppModules();

    // Collect a sample of expectations from the dump, then stop reading it.
    const wanted = [];
    for await (const rec of dumpUsers(DUMP)) {
        if (rec.broken) continue;
        const user = rec.user;
        if (!user.username || !user.library) continue;
        let snaps;
        try { snaps = snapshotLibrary(Library, listToCsv, user.library); } catch { continue; }
        for (const [externalId, snap] of snaps) {
            wanted.push({ externalId, username: user.username, snap });
            if (wanted.length >= LIMIT) break;
        }
        if (wanted.length >= LIMIT) break;
    }

    // An externalId can appear in more than one user's library -- that is what
    // fix-duplicate-externalids.cjs exists for. The list table can only point
    // at one of them, so the server would render the other user's list and
    // every field would read as a diff. Check ownership first and report the
    // collision as itself.
    const owners = new Map();
    for (let i = 0; !has('no-ownership-check') && i < wanted.length; i += 500) {
        const slice = wanted.slice(i, i + 500).map((w) => w.externalId);
        const rows = await knex('users')
            .join('list', 'users.user_id', '=', 'list.user_id')
            .select('users.username', 'list.external_id')
            .whereIn('list.external_id', slice);
        for (const r of rows) owners.set(r.external_id, r.username);
    }

    const checkable = has('no-ownership-check') ? wanted : wanted.filter(({ externalId, username }) => {
        const owner = owners.get(externalId);
        if (owner === undefined) { noteBucket('list:not-in-postgres', `${username}/${externalId}`); return false; }
        if (owner !== username) { noteBucket('list:owned-by-another-user', `${externalId} dump=${username} pg=${owner}`); return false; }
        return true;
    });

    const renderTarget = `${NEW_BASE}${NEW_HOST ? ` (Host: ${NEW_HOST})` : ''}`;
    console.error(`checking ${checkable.length} of ${wanted.length} rendered lists against ${renderTarget}`);

    await runPool(checkable, async ({ externalId, username, snap }) => {
        const label = `${username}/${externalId}`;
        const seen = new Set();
        const report = (p) => { if (!seen.has(p)) { seen.add(p); noteBucket(p, label); } };

        const [csvRes, htmlRes] = await Promise.all([
            fetchText(`${NEW_BASE}/csv/${externalId}`, { host: NEW_HOST }),
            fetchText(`${NEW_BASE}/r/${externalId}`, { host: NEW_HOST }),
        ]);

        if (csvRes.status !== 200) report(`new:csv-http-${csvRes.status}`);
        else compareCsv(snap.csv, csvRes.body, report);

        if (htmlRes.status !== 200) report(`new:render-http-${htmlRes.status}`);
        else compareRenderToSnapshot(snap, htmlRes.body, report);
    }, CONCURRENCY, progressReporter({ showOld: false }));

    await knex.destroy();
    console.log(JSON.stringify({
        mode: 'render',
        listsSampled: wanted.length,
        listsChecked: checkable.length,
        diffBuckets: summary(),
    }, null, 2));
    return buckets.size === 0 ? 0 : 1;
}

// A small sample against live production, as an independent cross-check.
async function modeProd() {
    const { knex } = await loadAppModules();

    let ledger = { checked: {} };
    if (!has('reset') && fs.existsSync(LEDGER_PATH)) {
        try { ledger = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8')); } catch { /* start fresh */ }
    }
    const saveLedger = () => {
        fs.mkdirSync(path.dirname(LEDGER_PATH), { recursive: true });
        fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger));
    };

    const rows = await knex('list').select('external_id').orderBy('external_id');
    const todo = rows.map((r) => r.external_id)
        .filter((id) => !ledger.checked[id])
        .slice(0, LIMIT === Infinity ? undefined : LIMIT);

    const target = `${OLD_BASE}${OLD_HOST ? ` (Host: ${OLD_HOST})` : ''}`;
    console.error(`${rows.length} lists in database, checking ${todo.length} against ${target}`);
    if (THROTTLED) {
        console.error(`throttled to ${RPS}/sec -- estimated ${Math.round((todo.length * 2) / RPS / 60)} minutes`);
    } else {
        console.error('unthrottled (--rps 0) -- only do this against a box nobody is using');
    }

    await runPool(todo, async (id) => {
        const seen = new Set();
        const report = (p) => { if (!seen.has(p)) { seen.add(p); noteBucket(p, id); } };

        const [oldCsv, newCsv] = await Promise.all([
            fetchText(`${OLD_BASE}/csv/${id}`, { rateLimited: true, host: OLD_HOST }),
            fetchText(`${NEW_BASE}/csv/${id}`),
        ]);

        // A 400 means "no such list". Both sides agreeing a share URL is dead
        // is not a regression -- only a disagreement is.
        if (oldCsv.status === 400 && newCsv.status === 400) { /* agree */ }
        else if (oldCsv.status === 400) report('list:only-on-new');
        else if (newCsv.status === 400) report('list:MISSING-on-new');
        else if (oldCsv.status !== 200) report(`old:http-${oldCsv.status}`);
        else if (newCsv.status !== 200) report(`new:http-${newCsv.status}`);
        else compareCsv(oldCsv.body, newCsv.body, report);

        if (oldCsv.status === 200 && newCsv.status === 200) {
            const [oldHtml, newHtml] = await Promise.all([
                fetchText(`${OLD_BASE}/r/${id}`, { rateLimited: true, host: OLD_HOST }),
                fetchText(`${NEW_BASE}/r/${id}`),
            ]);
            if (oldHtml.status !== 200) report(`old:render-http-${oldHtml.status}`);
            else if (newHtml.status !== 200) report(`new:render-http-${newHtml.status}`);
            else {
                compareTotals(oldHtml.body, newHtml.body, report);
                compareDescription(oldHtml.body, newHtml.body, report);
            }
        }

        ledger.checked[id] = seen.size === 0 ? 'ok' : [...seen].join(',');
        // The 8-way cap protects a live production box. Against a clone with no
        // users on it there is nothing to protect, so honour --concurrency.
    }, THROTTLED ? Math.min(CONCURRENCY, 8) : CONCURRENCY, ((report) => (done, total) => {
        if (done % 200 === 0 || done === total) saveLedger();
        report(done, total);
    })(progressReporter({ showOld: true })));

    saveLedger();
    await knex.destroy();
    console.log(JSON.stringify({
        mode: 'prod',
        listsChecked: todo.length,
        diffBuckets: summary(),
    }, null, 2));
    return buckets.size === 0 ? 0 : 1;
}

async function main() {
    if (has('help')) { console.log(USAGE); return 0; }
    if (MODE === 'data') return modeData();
    if (MODE === 'render') return modeRender();
    if (MODE === 'prod') return modeProd();
    console.error(`Unknown mode "${MODE}".\n\n${USAGE}`);
    return 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    process.exit(await main());
}
