import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { listToCsv, escapeField } from '../../server/csv.js';
import { Library } from '../../client/dataTypes.js';
import weightUtils from '../../client/utils/weight.js';

describe('escapeField', () => {
    test('quotes fields containing commas', () => {
        assert.equal(escapeField('a,b'), '"a,b"');
    });

    test('quotes fields containing quotes and doubles them', () => {
        assert.equal(escapeField('say "hi"'), '"say ""hi"""');
    });

    test('quotes fields containing newlines', () => {
        assert.equal(escapeField('line1\nline2'), '"line1\nline2"');
        assert.equal(escapeField('line1\rline2'), '"line1\rline2"');
    });

    test('passes plain fields through unquoted', () => {
        assert.equal(escapeField('plain'), 'plain');
        assert.equal(escapeField(42), '42');
    });

    test('renders null and undefined as empty', () => {
        assert.equal(escapeField(null), '');
        assert.equal(escapeField(undefined), '');
    });
});

describe('listToCsv', () => {
    test('renders header plus one row per item with mapped unit names and worn/consumable flags', () => {
        const library = new Library();
        const list = library.lists[0];
        const category = library.categories[0];
        category.name = 'Shelter';

        const item = library.items[0];
        item.name = 'Tent, UL2';
        item.weight = weightUtils.WeightToMg(2, 'lb');
        item.authorUnit = 'lb';
        item.price = 100;
        category.categoryItems[0].worn = 1;

        const csv = listToCsv(library, list);
        const lines = csv.trimEnd().split('\n');

        assert.equal(lines[0], 'Item Name,Category,desc,qty,weight,unit,url,price,worn,consumable');
        assert.equal(lines.length, 2);
        assert.equal(lines[1], '"Tent, UL2",Shelter,,1,2,pound,,100,Worn,');
    });

    test('skips categoryItems whose item no longer exists', () => {
        const category = {
            name: 'C',
            categoryItems: [
                { itemId: 1, qty: 1, worn: 0, consumable: false },
                { itemId: 2, qty: 1, worn: 0, consumable: false }, // dangling
            ],
        };
        const item = {
            name: 'Real', description: '', weight: 1000, authorUnit: 'g', url: '', price: 0,
        };
        const library = {
            getCategoryById: () => category,
            getItemById: (id) => (id === 1 ? item : undefined),
        };
        const list = { categoryIds: [7] };

        const csv = listToCsv(library, list);
        const lines = csv.trimEnd().split('\n');

        assert.equal(lines.length, 2); // header + the one real item
        assert.match(lines[1], /^Real,/);
    });

    test('skips categoryIds whose category no longer exists', () => {
        const library = {
            getCategoryById: () => undefined,
            getItemById: () => undefined,
        };
        const list = { categoryIds: [7] };

        const csv = listToCsv(library, list);

        assert.equal(csv, 'Item Name,Category,desc,qty,weight,unit,url,price,worn,consumable\n');
    });
});
