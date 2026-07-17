// Layer 1 validation gate for library format changes: compares what an old
// dataTypes.js (default: master, i.e. what prod clients run) computes against
// the current branch's dataTypes.js, for every user in a prod dump.
//
//   node scripts/compare-datatypes-formats.mjs logs/users-YYYY-MM-DD.json.gz [--old-ref master]
//
// Semantic comparison — every item field, every categoryItem, every category
// subtotal, every list total — plus, on the new side: round-trip stability
// (save→load→save byte-identical), version stamp, allowlist purity (no
// unknown keys in save output at any level), and settings copy-down equality
// (each list's optionalFields must equal the old library-level values).
// Diffs are bucketed by pattern so intentional changes read as a few
// explained lines, not 300k rows.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import readline from 'node:readline';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const args = process.argv.slice(2);
const dumpPath = args.find((a) => !a.startsWith('--'));
const oldRef = args.includes('--old-ref') ? args[args.indexOf('--old-ref') + 1] : 'master';
if (!dumpPath) {
    console.error('Usage: node scripts/compare-datatypes-formats.mjs <dump.json.gz> [--old-ref master]');
    process.exit(1);
}

// Extract the old dataTypes (and the utils it requires) from git into a
// temp dir, with a node_modules symlink so lodash resolves.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-datatypes-'));
fs.mkdirSync(path.join(tmpDir, 'client/utils'), { recursive: true });
const gitShow = (file) => execFileSync('git', ['show', `${oldRef}:${file}`], { cwd: repoRoot, maxBuffer: 16 * 1024 * 1024 });
fs.writeFileSync(path.join(tmpDir, 'client/dataTypes.js'), gitShow('client/dataTypes.js'));
fs.writeFileSync(path.join(tmpDir, 'client/utils/color.js'), gitShow('client/utils/color.js'));
fs.writeFileSync(path.join(tmpDir, 'client/utils/weight.js'), gitShow('client/utils/weight.js'));
const nodeModules = path.dirname(path.dirname(require.resolve('lodash/assignIn.js')));
fs.symlinkSync(nodeModules, path.join(tmpDir, 'node_modules'));

const oldSource = fs.readFileSync(path.join(tmpDir, 'client/dataTypes.js'), 'utf8');
let OLD;
if (oldSource.includes('module.exports')) {
    OLD = require(path.join(tmpDir, 'client/dataTypes.js'));
} else {
    OLD = await import(pathToFileURL(path.join(tmpDir, 'client/dataTypes.js')).href);
}
const NEW = await import(pathToFileURL(path.join(repoRoot, 'client/dataTypes.js')).href);

const ITEM_FIELDS = ['name', 'description', 'weight', 'authorUnit', 'price', 'image', 'imageUrl', 'url'];
const LIST_TOTALS = ['totalWeight', 'totalWornWeight', 'totalConsumableWeight', 'totalBaseWeight', 'totalPackWeight', 'totalPrice', 'totalConsumablePrice', 'totalQty'];
const CAT_SUBTOTALS = ['subtotalWeight', 'subtotalWornWeight', 'subtotalConsumableWeight', 'subtotalPrice', 'subtotalConsumablePrice', 'subtotalQty'];
const CI_FIELDS = ['itemId', 'qty', 'worn', 'consumable', 'star'];
const LIB_FIELDS = ['defaultListId', 'totalUnit', 'itemUnit', 'currencySymbol', 'showSidebar'];

// Allowlist purity: the exact key sets 0.4 save output may contain.
const SAVE_KEYS = {
    library: new Set(['version', 'totalUnit', 'itemUnit', 'defaultListId', 'sequence', 'showSidebar', 'preferences', 'currencySymbol', 'items', 'categories', 'lists']),
    item: new Set(['id', 'name', 'description', 'weight', 'authorUnit', 'price', 'image', 'imageUrl', 'url']),
    category: new Set(['id', 'name', 'categoryItems', 'color']),
    categoryItem: new Set(['qty', 'worn', 'consumable', 'star', 'itemId']),
    list: new Set(['id', 'name', 'categoryIds', 'description', 'externalId', 'optionalFields']),
};

const buckets = new Map();
const diff = (pattern, username) => {
    let b = buckets.get(pattern);
    if (!b) { b = { users: new Set(), samples: [] }; buckets.set(pattern, b); }
    if (!b.users.has(username)) {
        b.users.add(username);
        if (b.samples.length < 5) b.samples.push(username);
    }
};

let users = 0;
let identical = 0;
let oldLoadErrors = 0;
let newLoadErrors = 0;
let unstableRoundTrips = 0;
const errorSamples = [];
const unstableSamples = [];

const stream = fs.createReadStream(dumpPath).pipe(zlib.createGunzip());
const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

for await (const line of rl) {
    if (!line.trim()) continue;
    let a; let b;
    try { a = JSON.parse(line); b = JSON.parse(line); } catch { continue; }
    users++;
    const username = a.username;

    const libOld = new OLD.Library();
    const libNew = new NEW.Library();
    let oldErr = null; let newErr = null;
    try { libOld.load(a.library); } catch (err) { oldErr = err; }
    try { libNew.load(b.library); } catch (err) { newErr = err; }

    if (oldErr || newErr) {
        if (oldErr) oldLoadErrors++;
        if (newErr) newLoadErrors++;
        if (!!oldErr !== !!newErr) diff('load.error-mismatch', username);
        if (errorSamples.length < 10) errorSamples.push(`${username}: old=${oldErr?.message} new=${newErr?.message}`);
        continue;
    }

    let userClean = true;
    const mark = (pattern) => { userClean = false; diff(pattern, username); };

    for (const f of LIB_FIELDS) {
        if (!Object.is(libOld[f], libNew[f])) mark(`library.${f}`);
    }

    // Settings copy-down: every list's optionalFields must equal the old
    // library-level values (with defaults merged, as the old load did).
    if (libOld.optionalFields) {
        for (const list of libNew.lists) {
            for (const key of Object.keys(libOld.optionalFields)) {
                if (!Object.is(libOld.optionalFields[key], list.optionalFields[key])) {
                    mark(`list.optionalFields.${key}`);
                }
            }
        }
    }

    // Items: presence + every canonical field
    const oldItems = new Map(libOld.items.map((it) => [it.id, it]));
    const newItems = new Map(libNew.items.map((it) => [it.id, it]));
    for (const id of oldItems.keys()) if (!newItems.has(id)) mark('items.missing-in-new');
    for (const id of newItems.keys()) if (!oldItems.has(id)) mark('items.extra-in-new');
    for (const [id, oi] of oldItems) {
        const ni = newItems.get(id);
        if (!ni) continue;
        for (const f of ITEM_FIELDS) {
            if (!Object.is(oi[f], ni[f])) mark(`item.${f}`);
        }
    }

    // Totals: calculate on both sides, then compare lists and categories
    for (const list of libOld.lists) list.calculateTotals();
    for (const list of libNew.lists) list.calculateTotals();

    const oldLists = new Map(libOld.lists.map((l) => [l.id, l]));
    const newLists = new Map(libNew.lists.map((l) => [l.id, l]));
    if (oldLists.size !== newLists.size) mark('lists.count');
    for (const [id, ol] of oldLists) {
        const nl = newLists.get(id);
        if (!nl) continue;
        for (const f of LIST_TOTALS) {
            if (!Object.is(ol[f], nl[f])) mark(`list.${f}`);
        }
        if ((ol.categoryIds || []).join(',') !== (nl.categoryIds || []).join(',')) mark('list.categoryIds');
    }

    const oldCats = new Map(libOld.categories.map((c) => [c.id, c]));
    const newCats = new Map(libNew.categories.map((c) => [c.id, c]));
    if (oldCats.size !== newCats.size) mark('categories.count');
    for (const [id, oc] of oldCats) {
        const nc = newCats.get(id);
        if (!nc) continue;
        if (!Object.is(oc.name, nc.name)) mark('category.name');
        for (const f of CAT_SUBTOTALS) {
            if (!Object.is(oc[f], nc[f])) mark(`category.${f}`);
        }
        const oci = oc.categoryItems || [];
        const nci = nc.categoryItems || [];
        if (oci.length !== nci.length) {
            mark('category.categoryItems.length');
        } else {
            for (let i = 0; i < oci.length; i++) {
                for (const f of CI_FIELDS) {
                    if (!Object.is(oci[i][f], nci[i][f])) mark(`categoryItem.${f}`);
                }
            }
        }
    }

    if (userClean) identical++;

    // New-side invariants: round-trip stability, version stamp, allowlist purity
    try {
        const saved = libNew.save();
        if (saved.version !== '0.4') mark('save.version');

        for (const key of Object.keys(saved)) if (!SAVE_KEYS.library.has(key)) mark(`save.unknown-key.library.${key}`);
        for (const item of saved.items) {
            for (const key of Object.keys(item)) if (!SAVE_KEYS.item.has(key)) mark(`save.unknown-key.item.${key}`);
        }
        for (const category of saved.categories) {
            for (const key of Object.keys(category)) if (!SAVE_KEYS.category.has(key)) mark(`save.unknown-key.category.${key}`);
            for (const ci of category.categoryItems) {
                for (const key of Object.keys(ci)) if (!SAVE_KEYS.categoryItem.has(key)) mark(`save.unknown-key.categoryItem.${key}`);
            }
        }
        for (const list of saved.lists) {
            for (const key of Object.keys(list)) if (!SAVE_KEYS.list.has(key)) mark(`save.unknown-key.list.${key}`);
        }

        const first = JSON.stringify(saved);
        const re = new NEW.Library();
        re.load(JSON.parse(first));
        if (JSON.stringify(re.save()) !== first) {
            unstableRoundTrips++;
            if (unstableSamples.length < 10) unstableSamples.push(username);
        }
    } catch (err) {
        unstableRoundTrips++;
        if (unstableSamples.length < 10) unstableSamples.push(`${username}: ${err.message}`);
    }

    if (users % 25000 === 0) console.error(`...${users} users`);
}

const bucketReport = Object.fromEntries(
    [...buckets.entries()]
        .sort((x, y) => y[1].users.size - x[1].users.size)
        .map(([pattern, b]) => [pattern, { users: b.users.size, samples: b.samples }]),
);

console.log(JSON.stringify({
    oldRef,
    users,
    semanticallyIdentical: identical,
    oldLoadErrors,
    newLoadErrors,
    unstableRoundTrips,
    diffBuckets: bucketReport,
    errorSamples,
    unstableSamples,
}, null, 2));
