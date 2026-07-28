import path from 'path';
import fs from 'fs';
import express from 'express';
import Mustache from 'mustache';
import { Marked } from 'marked';
import { thumbnailUrl } from './images.js';
import config from 'config';
import cloneDeep from 'lodash/cloneDeep.js';
import Knex from 'knex';
import { logWithRequest, logger } from './log.js';
import weightUtils from '../client/utils/weight.js';
import { marked, isSafeHref } from '../client/utils/markdown.js';
import { Library } from '../client/dataTypes.js';
import { listToCsv } from './csv.js';

const router = express.Router();

const knex = Knex({
    client: 'pg',
    connection: cloneDeep(config.get('pgDatabase'))
});

const templates = {};
let shareTemplate = '';
let embedTemplate = '';
let embedJTemplate = '';
// Absolute, unlike the style links: the embed runs on another origin.
const embedScriptUrls = [];

const vueRoutes = [ /* TODO - get this from same data source as Vue */
    { path: '/' },
    { path: '/signin' },
    { path: '/signin/reset-password' },
    { path: '/signin/forgot-username' },
    { path: '/welcome' },
    { path: '/register' },
    { path: '/forgot-password' },
    { path: '/reset-password/:token' },
    { path: '/moderation' },
];

let index = fs.readFileSync(path.join(import.meta.dirname, '../_index.html'), 'utf8');
let shareStylesHtml = '';
const shareStylesLinks = [];
let shareScriptsHtml = '';
let appScriptsHtml = '';
let appStylesHtml = '';
let docStylesHtml = '';

const manifestPath = path.join(import.meta.dirname, '../public/dist/.vite/manifest.json');
const hasBuiltAssets = fs.existsSync(manifestPath);

if (hasBuiltAssets) {
    // Production / test: serve pre-built Vite assets
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    // App entry
    const appEntry = manifest['client/lighterpack.js'];
    if (appEntry) {
        appScriptsHtml += `<script type="module" src='/dist/${appEntry.file}'></script>`;
        (appEntry.css || []).forEach((cssFile) => {
            appStylesHtml += `<link rel='stylesheet' href='/dist/${cssFile}' />`;
        });
    }

    // Share entry
    const shareEntry = manifest['client/share-entry.js'];
    if (shareEntry) {
        shareScriptsHtml += `<script type="module" src='/dist/${shareEntry.file}'></script>`;
        (shareEntry.css || []).forEach((cssFile) => {
            shareStylesHtml += `<link rel='stylesheet' href='/dist/${cssFile}' />`;
            shareStylesLinks.push(cssFile);
        });
    }

    const embedEntry = manifest['client/embed-entry.js'];
    if (embedEntry) {
        embedScriptUrls.push(`${config.get('deployUrl')}/e/dist/${embedEntry.file.replace('assets/', '')}`);
    }

    // Doc entry is CSS-only, so the manifest points `file` straight at the
    // stylesheet and there is no `css` array to walk.
    const docEntry = manifest['client/css/doc.scss'];
    if (docEntry) {
        docStylesHtml += `<link rel='stylesheet' href='/dist/${docEntry.file}' />`;
    }
} else {
    // Dev without a build: proxy to Vite dev server (port 5173).
    appStylesHtml = '';
    appScriptsHtml = '<script type="module" src="http://localhost:5173/@vite/client"></script>'
        + '<script type="module" src="http://localhost:5173/client/lighterpack.js"></script>';
    shareStylesHtml = '';
    shareScriptsHtml = '<script type="module" src="http://localhost:5173/@vite/client"></script>'
        + '<script type="module" src="http://localhost:5173/client/share-entry.js"></script>';
    embedScriptUrls.push('http://localhost:5173/client/embed-entry.js');
    // Vite serves scss as a JS module that injects a style tag, so in dev the
    // doc pages do load a script even though the built version never does.
    docStylesHtml = '<script type="module" src="http://localhost:5173/@vite/client"></script>'
        + '<script type="module" src="http://localhost:5173/client/css/doc.scss"></script>';
}

index = index.replace('{{styles}}', appStylesHtml);
index = index.replace('{{scripts}}', appScriptsHtml);

// Long-form document pages (/privacy, /terms) are rendered from markdown once
// at startup and served as static HTML — no JS, no database, nothing
// per-request to get wrong. The shared marked renderer is hardened for
// untrusted list descriptions: it drops inline HTML and stamps
// target="_blank" rel="nofollow ugc" on every link. That is wrong for a
// first-party document, so these get a default Marked instance of their own.
const docMarked = new Marked();

const docPages = [
    {
        path: '/privacy',
        file: 'PRIVACY.md',
        title: 'Privacy Policy',
        description: 'What LighterPack collects, who else handles it, and how to delete it.',
    },
    {
        path: '/terms',
        file: 'TERMS.md',
        title: 'Terms of Use',
        description: 'The house rules for using LighterPack, in plain English.',
    },
];

const docTemplate = fs.readFileSync(path.join(import.meta.dirname, '../templates/doc.mustache'), 'utf8');

function renderDocPage(doc, sibling) {
    const source = fs.readFileSync(path.join(import.meta.dirname, '..', doc.file), 'utf8');
    // Wide tables must scroll inside their own box rather than widening the
    // page on a phone; marked has no hook for wrapping a block-level token.
    const content = docMarked.parse(source)
        .replace(/<table>/g, '<div class="lpDocTableScroll"><table>')
        .replace(/<\/table>/g, '</table></div>');

    return Mustache.render(docTemplate, {
        styles: docStylesHtml,
        content,
        title: doc.title,
        description: doc.description,
        siblingPath: sibling.path,
        siblingTitle: sibling.title,
    });
}

docPages.forEach((doc, i) => {
    // Each doc links to the next one in the list, so the two policies stay
    // reachable from each other without either page hardcoding the other.
    const sibling = docPages[(i + 1) % docPages.length];
    let page = '';
    try {
        page = renderDocPage(doc, sibling);
    } catch (err) {
        logger.error({ message: `Error rendering ${doc.file}`, err });
    }

    router.get(doc.path, (req, res) => {
        if (!page) {
            return res.status(500).send(`${doc.title} is temporarily unavailable.`);
        }
        res.set('Cache-Control', 'public, max-age=3600');
        return res.send(page);
    });
});

for (let i = 0; i < vueRoutes.length; i++) {
    router.get(vueRoutes[i].path, (req, res) => {
        res.send(index);
    });
}

router.get('/r/:id', (req, res) => {
    renderListView(req, res);
});

async function renderListView(req, res) {
    const id = String(req.params.id).trim();

    if (!id) {
        res.status(400).send('No list specified!');
        return;
    }

    try {
        const users = await knex('users')
            .join('list', 'users.user_id', '=', 'list.user_id')
            .select('users.library')
            .where({'list.external_id': id });

        if (!users.length) {
            res.status(400).send('Invalid list specified.');
            return;
        }

        const user = users[0];

        const library = new Library();
        let list;

        if (typeof (user.library) === 'undefined') {
            logWithRequest(req, `Undefined user library with list ID ${id}`);
            return res.status(500).send('Unknown error.');
        }

        library.load(user.library);
        for (const i in library.lists) {
            if (library.lists[i].externalId && library.lists[i].externalId == id) {
                library.defaultListId = library.lists[i].id;
                list = library.lists[i];
                break;
            }
        }

        if (!list) { //List is in the DB but not the library
            res.status(400).send('Invalid list specified.');
            return;
        }

        const chartData = escape(JSON.stringify(list.renderChart('total', false)));
        const renderedCategories = renderLibrary(library, {
            itemTemplate: templates.t_itemShare,
            categoryTemplate: templates.t_categoryShare,
            optionalFields: list.optionalFields,
            unitSelectTemplate: templates.t_unitSelect,
            currencySymbol: library.currencySymbol,
        });

        const renderedTotals = renderLibraryTotals(library, templates.t_totals, templates.t_unitSelect);

        let model = {
            listName: list.name,
            chartData,
            renderedCategories,
            renderedTotals,
            optionalFields: list.optionalFields,
            renderedDescription: marked(list.description),
            scripts: shareScriptsHtml,
            styles: shareStylesHtml,
        };

        Object.assign(model, templates);
        res.send(Mustache.render(shareTemplate, model));
    } catch (err) {
        logWithRequest(req, {message: 'error rendering list', err});
        return res.status(500).send('An error occurred.');
    }
}

// The embed's bundle, served from a path we control so it can carry CORS —
// module scripts are fetched cors-mode, and /dist is served by Apache. The
// whole asset dir, not just the entry: the entry imports its chunks relatively.
// Filenames are content-hashed, hence immutable.
router.use('/e/dist', express.static(path.join(import.meta.dirname, '../public/dist/assets'), {
    immutable: true,
    maxAge: '1y',
    setHeaders: (res) => res.set('Access-Control-Allow-Origin', '*'),
}));

router.get('/e/:id', (req, res) => {
    renderEmberView(req, res);
});

async function renderEmberView(req, res) {
    const id = String(req.params.id).trim();

    if (!id) {
        res.status(400).send('No list specified!');
        return;
    }

    try {
        const users = await knex('users')
            .join('list', 'users.user_id', '=', 'list.user_id')
            .select('users.library')
            .where({'list.external_id': id });

        if (!users.length) {
            res.status(400).send('Invalid list specified.');
            return;
        }

        const user = users[0];

        const library = new Library();
        let list;

        if (typeof (user.library) === 'undefined') {
            logWithRequest(req, `Undefined user library with list ID ${id}`);
            return res.status(500).send('Unknown error.');
        }

        library.load(user.library);
        for (const i in library.lists) {
            if (library.lists[i].externalId && library.lists[i].externalId == id) {
                library.defaultListId = library.lists[i].id;
                list = library.lists[i];
                break;
            }
        }

        if (!list) { // List is in the DB but not the library
            res.status(400).send('Invalid list specified.');
            return;
        }

        const chartData = escape(JSON.stringify(list.renderChart('total', false)));

        const renderedCategories = renderLibrary(library, {
            itemTemplate: templates.t_itemShare,
            categoryTemplate: templates.t_categoryShare,
            optionalFields: list.optionalFields,
            unitSelectTemplate: templates.t_unitSelect,
            renderedDescription: marked(list.description),
            currencySymbol: library.currencySymbol,
        });

        const renderedTotals = renderLibraryTotals(library, templates.t_totals, templates.t_unitSelect);

        let model = {
            externalId: id,
            listName: list.name,
            chartData,
            renderedCategories,
            renderedTotals,
            optionalFields: list.optionalFields,
            renderedDescription: marked(list.description),
            baseUrl: config.get('deployUrl'),
            styles: shareStylesLinks,
            scripts: embedScriptUrls,
        };
        Object.assign(model, templates);
        model.renderedTemplate = escape(Mustache.render(embedTemplate, model));
        res.type('application/javascript');
        res.send(Mustache.render(embedJTemplate, model));
    } catch (err) {
        logWithRequest(req, {message: 'error rendering ember', err});
        return res.status(500).send('An error occurred.');
    }
}

router.get('/csv/:id', (req, res) => {
    renderListCSV(req, res);   
});

async function renderListCSV(req, res) {
    const id = req.params.id;

    if (!id) {
        res.status(400).send('No list specified!');
        return;
    }

    try {
        const users = await knex('users')
            .join('list', 'users.user_id', '=', 'list.user_id')
            .select('users.library')
            .where({'list.external_id': id });

        if (!users.length) {
            res.status(400).send('Invalid list specified.');
            return;
        }

        const user = users[0];

        const library = new Library();
        let list;

        if (typeof (user.library) === 'undefined') {
            logWithRequest(req, `Undefined user library with list ID ${id}`);
            return res.status(500).send('Unknown error.');
        }

        library.load(users[0].library);
        for (var i in library.lists) {
            if (library.lists[i].externalId && library.lists[i].externalId == id) {
                library.defaultListId = library.lists[i].id;
                list = library.lists[i];
                break;
            }
        }

        if (!list) {
            res.status(400).send('Invalid list specified.');
            return;
        }

        const out = listToCsv(library, list);

        let filename = list.name;
        if (!filename) filename = id;
        filename = filename.replace(/[^a-z0-9-]/gi, '_');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment;filename=${filename}.csv`);
        res.send(out);
    } catch (err) {
        logWithRequest(req, {message: 'error rendering csv', err});
        return res.status(500).send('An error occurred.');
    }
}

function init() {
    fs.readdir(path.join(import.meta.dirname, '../templates'), (err, files) => {
        if (err) {
            logger.error({message: 'Error loading templates', err});
        }
        files.filter((file) => (file.substr(0, 2) == 't_' && file.substr(-9) == '.mustache')).forEach((file) => {
            const fileShort = file.substr(0, file.length - 9);
            const data = fs.readFileSync(path.join(import.meta.dirname, '../templates/', file));
            templates[fileShort] = data.toString();
        });

        fs.readFile(path.join(import.meta.dirname, '../templates/share.mustache'), (err, data) => {
            if (!err) {
                shareTemplate = data.toString();
                shareTemplate = shareTemplate.replace(/\r?\n|\r/g, '');
            } else {
                logger.error({message: 'ERROR reading share.mustache', err});
            }
        });

        fs.readFile(path.join(import.meta.dirname, '../templates/embed.mustache'), (err, data) => {
            if (!err) {
                embedTemplate = data.toString();
                embedTemplate = embedTemplate.replace(/\r?\n|\r/g, '');
            } else {
                logger.error({message: 'ERROR reading embed.mustache', err});
            }
        });

        fs.readFile(path.join(import.meta.dirname, '../templates/embed.jmustache'), (err, data) => {
            if (!err) {
                embedJTemplate = data.toString();
            } else {
                logger.error({message: 'ERROR reading embed.jmustache', err});
            }
        });

        // fs.writeFile(filePath, data, function(err) {
        logger.info({message: 'views init complete.'});
    });
}

const renderItem = function (item, args) {
    let classes = '';
    if (args.classes) classes = args.classes;
    if (item.deleteIfEmpty) classes += ' deleteIfEmpty';

    let unit = item.authorUnit;
    if (args.unit) unit = args.unit;

    const displayWeight = weightUtils.MgToDisplayWeight(item.weight, unit);

    const displayPrice = item.price ? item.price.toFixed(2) : '0.00';

    const unitSelect = renderUnitSelect(unit, args.unitSelectTemplate, item.weight);

    const starClass = item.star ? `lpStar${item.star}` : '';
    const out = {
        classes, unit, displayWeight, unitSelect, showImages: args.showImages, showPrices: args.showPrices, starClass, displayPrice, currencySymbol: args.currencySymbol,
    };
    Object.assign(out, item);
    out.imageThumbUrl = thumbnailUrl(item.imageUrl);

    // Mustache escapes HTML but not URL schemes, so drop unsafe hrefs
    // (javascript:, data:, ...) before the item name is rendered as a link.
    if (out.url && !isSafeHref(out.url)) out.url = '';

    return Mustache.render(args.itemTemplate, out);
};

const renderCategory = function (category, args) {
    let items = '';
    for (const i in category.categoryItems) {
        const categoryItem = category.categoryItems[i];
        const item = category.library.getItemById(categoryItem.itemId);
        if (!item) continue; // defensive: skip a dangling itemId instead of throwing
        Object.assign(item, categoryItem);
        items += renderItem(item, args);
    }

    category.calculateSubtotal(args.listOptionalFields);
    category.subtotalWeightDisplay = weightUtils.MgToDisplayWeight(category.subtotalWeight, args.totalUnit);
    category.subtotalPriceDisplay = category.subtotalPrice ? category.subtotalPrice.toFixed(2) : '0.00';
    let temp = Object.assign({}, category);
    Object.assign(temp, {
        items, subtotalUnit: args.totalUnit, currencySymbol: args.currencySymbol, showPrices: args.showPrices,
    });

    return Mustache.render(args.categoryTemplate, temp);
};

const renderList = function (list, args) {
    args.showPrices = list.optionalFields.price;
    args.showImages = list.optionalFields.images;
    args.listOptionalFields = list.optionalFields;
    let out = '';
    for (const i in list.categoryIds) {
        const category = list.library.getCategoryById(list.categoryIds[i]);
        if (category) out += renderCategory(category, args);
    }
    return out;
};

var renderLibrary = function (library, args) {
    Object.assign(args, { itemUnit: library.itemUnit, totalUnit: library.totalUnit });
    return renderList(library.getListById(library.defaultListId), args);
};

const renderListTotals = function (list, totalsTemplate, unitSelectTemplate, unit) {
    let totalWeight = 0;
    let totalWornWeight = 0;
    let totalConsumableWeight = 0;
    let totalBaseWeight = 0;
    let totalPackWeight = 0;
    let totalQty = 0;
    let totalPrice = 0;
    let totalConsumablePrice = 0;
    const out = { categories: [] };

    for (const i in list.categoryIds) {
        const category = list.library.getCategoryById(list.categoryIds[i]);

        if (category) {
            category.calculateSubtotal(list.optionalFields);
            category.subtotalWeightDisplay = weightUtils.MgToDisplayWeight(category.subtotalWeight, unit);
            category.subtotalUnit = unit;

            totalWeight += category.subtotalWeight;
            totalPrice += category.subtotalPrice;
            totalWornWeight += category.subtotalWornWeight;
            totalConsumableWeight += category.subtotalConsumableWeight;
            totalConsumablePrice += category.subtotalConsumablePrice;
            totalQty += category.subtotalQty;
            out.categories.push(category);
        }
    }

    totalBaseWeight = totalWeight - (totalWornWeight + totalConsumableWeight);
    totalPackWeight = totalWeight - totalWornWeight;

    out.totalWeight = totalWeight;
    out.totalWeightDisplay = weightUtils.MgToDisplayWeight(totalWeight, unit);
    out.totalUnit = renderUnitSelect(unit, unitSelectTemplate, totalWeight);
    out.subtotalUnit = unit;
    out.totalWornWeight = totalWornWeight;
    out.totalWornWeightDisplay = weightUtils.MgToDisplayWeight(totalWornWeight, unit);
    out.totalConsumableWeight = totalConsumableWeight;
    out.totalConsumableWeightDisplay = weightUtils.MgToDisplayWeight(totalConsumableWeight, unit);
    out.totalBaseWeight = totalBaseWeight;
    out.totalBaseWeightDisplay = weightUtils.MgToDisplayWeight(totalBaseWeight, unit);
    out.shouldDisplayBaseWeight = totalBaseWeight !== totalWeight;
    out.totalPackWeight = totalPackWeight;
    out.totalPackWeightDisplay = weightUtils.MgToDisplayWeight(totalPackWeight, unit);
    out.showPackWeight = list.optionalFields.packWeight;
    out.totalQty = totalQty;
    out.totalPrice = totalPrice;
    out.totalPriceDisplay = totalPrice ? totalPrice.toFixed(2) : '';
    out.totalConsumablePrice = totalConsumablePrice;
    out.totalConsumablePriceDisplay = totalConsumablePrice ? totalConsumablePrice.toFixed(2) : '';
    out.showPrices = list.optionalFields.price;
    out.currencySymbol = list.library.currencySymbol;

    return Mustache.render(totalsTemplate, out);
};

var renderLibraryTotals = function (library, totalsTemplate, unitSelectTemplate) {
    return renderListTotals(library.getListById(library.defaultListId), totalsTemplate, unitSelectTemplate, library.totalUnit);
};

function renderUnitSelect(unit, unitSelectTemplate, weight) {
    const temp = { unit, units: [{ unit: 'oz', selected: (unit == 'oz') }, { unit: 'lb', selected: (unit == 'lb') }, { unit: 'g', selected: (unit == 'g') }, { unit: 'kg', selected: (unit == 'kg') }], weight };
    return Mustache.render(unitSelectTemplate, temp);
}

init();

export default router;
