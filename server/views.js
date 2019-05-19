const Vue = require('vue');
const path = require('path');
const fs = require('fs');
const express = require('express');

const router = express.Router();
const Mustache = require('mustache');
const extend = require('node.extend');
const markdown = require('markdown').markdown;
const config = require('config');
const mongojs = require('mongojs');
const awesomeLog = require('./log.js');

const collections = ['users', 'libraries'];
const db = mongojs(config.get('databaseUrl'), collections);

const weightUtils = require('../client/utils/weight.js');
const dataTypes = require('../client/dataTypes.js');

const Item = dataTypes.Item;
const Category = dataTypes.Category;
const List = dataTypes.List;
const Library = dataTypes.Library;

const templates = {};

const vueRoutes = [ /* TODO - get this from same data source as Vue */
    { path: '/' },
    { path: '/signin' },
    { path: '/signin/reset-password' },
    { path: '/signin/forgot-username' },
    { path: '/welcome' },
    { path: '/register' },
    { path: '/forgot-password' },
];

let index = fs.readFileSync(path.join(__dirname, '../_index.html'), 'utf8');
let assetData;
let shareStylesHtml = '';
let shareScriptsHtml = '';
let appScriptsHtml = '';
let appStylesHtml = '';

if (config.get('environment') === 'production') {
    assetData = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/dist/assets.json'), 'utf8'));
    const appAssetFiles = assetData.files.app;

    appAssetFiles.forEach((assetName) => {
        if (assetName.substr(assetName.length - 3) === '.js') {
            appScriptsHtml += `<script src='/dist/${assetName}'></script>`;
        } else if (assetName.substr(assetName.length - 4) === '.css') {
            appStylesHtml += `<link rel='stylesheet' href='/dist/${assetName}' />`;
        }
    });

    const shareAssetFiles = assetData.files.app;
    shareAssetFiles.forEach((assetName) => {
        if (assetName.substr(assetName.length - 3) === '.js') {
            shareScriptsHtml += `<script src='/dist/${assetName}'></script>`;
        } else if (assetName.substr(assetName.length - 4) === '.css') {
            shareStylesHtml += `<link rel='stylesheet' href='/dist/${assetName}' />`;
        }
    });
} else {
    appStylesHtml = '';
    appScriptsHtml = '<script src=\'/dist/app.js\'></script>';
    shareStylesHtml = '';
    shareScriptsHtml = '<script src=\'/dist/share.js\'></script>';
}

index = index.replace('{{styles}}', appStylesHtml);
index = index.replace('{{scripts}}', appScriptsHtml);

for (let i = 0; i < vueRoutes.length; i++) {
    router.get(vueRoutes[i].path, (req, res) => {
        awesomeLog(req);
        res.send(index);
    });
}

router.get('/r/:id', (req, res) => {
    const id = req.params.id;
    awesomeLog(req);

    if (!id) {
        res.status(400).send('No list specified!');
        return;
    }
    db.users.find({ 'library.lists.externalId': id }, (err, users) => {
        if (err) {
            res.status(500).send('An error occurred.');
            return;
        }
        if (!users.length) {
            res.status(400).send('Invalid list specified.');
            return;
        }
        const library = new Library();
        let list;

        if (!users[0] || typeof (users[0].library) === 'undefined') {
            awesomeLog(req, 'Undefined users[0].');
            res.status(500).send('Unknown error.');
        }

        library.load(users[0].library);
        for (const i in library.lists) {
            if (library.lists[i].externalId && library.lists[i].externalId == id) {
                library.defaultListId = library.lists[i].id;
                list = library.lists[i];
                break;
            }
        }

        const chartData = escape(JSON.stringify(list.renderChart('total', false)));
        const renderedCategories = renderLibrary(library, {
            itemTemplate: templates.t_itemShare,
            categoryTemplate: templates.t_categoryShare,
            optionalFields: library.optionalFields,
            unitSelectTemplate: templates.t_unitSelect,
            currencySymbol: library.currencySymbol,
        });

        const renderedTotals = renderLibraryTotals(library, templates.t_totals, templates.t_unitSelect, library.totalUnit);

        let model = {
            listName: list.name,
            chartData,
            renderedCategories,
            renderedTotals,
            optionalFields: library.optionalFields,
            renderedDescription: markdown.toHTML(list.description),
            scripts: shareScriptsHtml,
            styles: shareStylesHtml,
        };

        model = extend(model, templates);
        res.send(Mustache.render(shareTemplate, model));
    });
});

router.get('/e/:id', (req, res) => {
    const id = req.params.id;
    awesomeLog(req);

    if (!id) {
        res.status(400).send('No list specified!');
        return;
    }

    db.users.find({ 'library.lists.externalId': id }, (err, users) => {
        if (err) {
            res.status(500).send('An error occurred.');
            return;
        }

        if (!users.length) {
            res.status(400).send('Invalid list specified.');
            return;
        }

        const library = new Library();
        let list;

        if (!users[0] || typeof (users[0].library) === 'undefined') {
            awesomeLog(req, 'Undefined users[0].');
            res.status(500).send('Unknown error.');
        }

        library.load(users[0].library);
        for (const i in library.lists) {
            if (library.lists[i].externalId && library.lists[i].externalId == id) {
                library.defaultListId = library.lists[i].id;
                list = library.lists[i];
                break;
            }
        }

        const chartData = escape(JSON.stringify(list.renderChart('total', false)));

        const renderedCategories = renderLibrary(library, {
            itemTemplate: templates.t_itemShare,
            categoryTemplate: templates.t_categoryShare,
            optionalFields: library.optionalFields,
            unitSelectTemplate: templates.t_unitSelect,
            renderedDescription: markdown.toHTML(list.description),
            currencySymbol: library.currencySymbol,
        });

        const renderedTotals = renderLibraryTotals(library, templates.t_totals, templates.t_unitSelect);

        let model = {
            externalId: id,
            listName: list.name,
            chartData,
            renderedCategories,
            renderedTotals,
            optionalFields: library.optionalFields,
            renderedDescription: markdown.toHTML(list.description),
            baseUrl: config.get('deployUrl'),
        };
        model = extend(model, templates);
        model.renderedTemplate = escape(Mustache.render(embedTemplate, model));
        res.send(Mustache.render(embedJTemplate, model));
    });
});

router.get('/csv/:id', (req, res) => {
    const id = req.params.id;
    awesomeLog(req);

    if (!id) {
        res.status(400).send('No list specified!');
        return;
    }

    db.users.find({ 'library.lists.externalId': id }, (err, users) => {
        if (err) {
            res.status(500).send('An error occurred.');
            return;
        }

        if (!users.length) {
            res.status(400).send('Invalid list specified.');
            return;
        }

        const library = new Library();
        let list;

        if (!users[0] || typeof (users[0].library) === 'undefined') {
            awesomeLog(req, 'Undefined users[0].');
            res.status(500).send('Unknown error.');
        }

        library.load(users[0].library);
        for (var i in library.lists) {
            if (library.lists[i].externalId && library.lists[i].externalId == id) {
                library.defaultListId = library.lists[i].id;
                list = library.lists[i];
                break;
            }
        }

        const fullUnits = {
            oz: 'ounce', lb: 'pound', g: 'gram', kg: 'kilogram',
        };
        let out = 'Item Name,Category,desc,qty,weight,unit,url,price,worn,consumable\n';

        for (var i in list.categoryIds) {
            const category = library.getCategoryById(list.categoryIds[i]);
            for (const j in category.categoryItems) {
                const categoryItem = category.categoryItems[j];
                const item = library.getItemById(categoryItem.itemId);

                const itemRow = [item.name];
                itemRow.push(category.name);
                itemRow.push(item.description);
                itemRow.push(`${categoryItem.qty}`);
                itemRow.push(`${weightUtils.MgToWeight(item.weight, item.authorUnit)}`);
                itemRow.push(fullUnits[item.authorUnit]);
                itemRow.push(item.url);
                itemRow.push(`${item.price}`);
                itemRow.push(categoryItem.worn ? 'Worn' : '');
                itemRow.push(categoryItem.consumable ? 'Consumable' : '');

                for (const k in itemRow) {
                    const field = itemRow[k];
                    if (k > 0) out += ',';
                    if (typeof (field) === 'string') {
                        if (field.indexOf(',') > -1) out += `"${field.replace(/\"/g, '""')}"`;
                        else out += field;
                    } else out += field;
                }
                out += '\n';
            }
        }

        let filename = list.name;
        if (!filename) filename = id;
        filename = filename.replace(/[^a-z0-9\-]/gi, '_');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment;filename=${filename}.csv`);
        res.send(out);
    });
});

function init() {
    fs.readdir(path.join(__dirname, '../templates'), (err, files) => {
        if (err) {
            console.log('Error loading templates');
            console.log(err);
        }
        files.filter(file => (file.substr(0, 2) == 't_' && file.substr(-9) == '.mustache')).forEach((file) => {
            const fileShort = file.substr(0, file.length - 9);
            const data = fs.readFileSync(path.join(__dirname, '../templates/', file));
            templates[fileShort] = data.toString();
        });

        fs.readFile(path.join(__dirname, '../templates/share.mustache'), (err, data) => {
            if (!err) {
                shareTemplate = data.toString();
                shareTemplate = shareTemplate.replace(/\r?\n|\r/g, '');
            } else {
                console.log('ERROR reading share.mustache');
            }
        });

        fs.readFile(path.join(__dirname, '../templates/embed.mustache'), (err, data) => {
            if (!err) {
                embedTemplate = data.toString();
                embedTemplate = embedTemplate.replace(/\r?\n|\r/g, '');
            } else {
                console.log('ERROR reading embed.mustache');
            }
        });

        fs.readFile(path.join(__dirname, '../templates/embed.jmustache'), (err, data) => {
            if (!err) {
                embedJTemplate = data.toString();
            } else {
                console.log('ERROR reading embed.jmustache');
            }
        });

        // fs.writeFile(filePath, data, function(err) {
        console.log('init complete.');
    });
}

const renderItem = function (item, args) {
    let classes = '';
    if (args.classes) classes = args.classes;
    if (item.deleteIfEmpty) classes += ' deleteIfEmpty';

    let unit = item.authorUnit;
    if (args.unit) unit = args.unit;

    const displayWeight = weightUtils.MgToWeight(item.weight, unit);

    const displayPrice = item.price ? item.price.toFixed(2) : '0.00';

    const unitSelect = renderUnitSelect(unit, args.unitSelectTemplate, item.weight);

    const starClass = item.star ? `lpStar${item.star}` : '';
    const out = {
        classes, unit, displayWeight, unitSelect, showImages: args.showImages, showPrices: args.showPrices, starClass, displayPrice, currencySymbol: args.currencySymbol,
    };
    Vue.util.extend(out, item);

    return Mustache.render(args.itemTemplate, out);
};

const renderCategory = function (category, args) {
    let items = '';
    for (const i in category.categoryItems) {
        const categoryItem = category.categoryItems[i];
        const item = category.library.getItemById(categoryItem.itemId);
        extend(item, categoryItem);
        items += renderItem(item, args);
    }

    category.calculateSubtotal();
    category.subtotalWeightDisplay = weightUtils.MgToWeight(category.subtotalWeight, args.totalUnit);

    category.subtotalPriceDisplay = category.subtotalPrice ? category.subtotalPrice.toFixed(2) : '0.00';
    
    let temp = Vue.util.extend({}, category);
    temp = Vue.util.extend(temp, {
        items, subtotalUnit: args.totalUnit, currencySymbol: args.currencySymbol, showPrices: args.showPrices,
    });

    return Mustache.render(args.categoryTemplate, temp);
};

const renderList = function (list, args) {
    args.showPrices = list.library.optionalFields.price;
    args.showImages = list.library.optionalFields.images;
    let out = '';
    for (const i in list.categoryIds) {
        const category = list.library.getCategoryById(list.categoryIds[i]);
        if (category) out += renderCategory(category, args);
    }
    return out;
};

var renderLibrary = function (library, args) {
    Vue.util.extend(args, { itemUnit: library.itemUnit, totalUnit: library.totalUnit });
    return renderList(library.getListById(library.defaultListId), args);
};

const renderListTotals = function (list, totalsTemplate, unitSelectTemplate, unit) {
    let totalWeight = 0;
    let totalWornWeight = 0;
    let totalConsumableWeight = 0;
    let totalPackWeight = 0;
    let totalQty = 0;
    let totalPrice = 0;
    let totalConsumablePrice = 0;
    const out = { categories: [] };

    for (const i in list.categoryIds) {
        const category = list.library.getCategoryById(list.categoryIds[i]);
        category.calculateSubtotal();
        category.subtotalWeightDisplay = weightUtils.MgToWeight(category.subtotalWeight, unit);
        category.subtotalUnit = unit;

        totalWeight += category.subtotalWeight;
        totalPrice += category.subtotalPrice;
        totalWornWeight += category.subtotalWornWeight;
        totalConsumableWeight += category.subtotalConsumableWeight;
        totalConsumablePrice += category.subtotalConsumablePrice;
        totalQty += category.subtotalQty;
        out.categories.push(category);
    }

    totalPackWeight = totalWeight - (totalWornWeight + totalConsumableWeight);

    out.totalWeight = totalWeight;
    out.totalWeightDisplay = weightUtils.MgToWeight(totalWeight, unit);
    out.totalUnit = renderUnitSelect(unit, unitSelectTemplate, totalWeight);
    out.subtotalUnit = unit;
    out.totalWornWeight = totalWornWeight;
    out.totalWornWeightDisplay = weightUtils.MgToWeight(totalWornWeight, unit);
    out.totalConsumableWeight = totalConsumableWeight;
    out.totalConsumableWeightDisplay = weightUtils.MgToWeight(totalConsumableWeight, unit);
    out.totalPackWeight = totalPackWeight;
    out.totalPackWeightDisplay = weightUtils.MgToWeight(totalPackWeight, unit);
    out.shouldDisplayPackWeight = totalPackWeight !== totalWeight;
    out.totalQty = totalQty;
    out.totalPrice = totalPrice;
    out.totalPriceDisplay = totalPrice ? totalPrice.toFixed(2) : '';
    out.totalConsumablePrice = totalConsumablePrice;
    out.totalConsumablePriceDisplay = totalConsumablePrice ? totalConsumablePrice.toFixed(2) : '';

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

module.exports = router;
