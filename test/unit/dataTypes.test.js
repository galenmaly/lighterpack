import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { Library, Item } from '../../client/dataTypes.js';

const categoryItem = (itemId, extra = {}) => ({
    qty: 1, worn: 0, consumable: false, star: 0, itemId, ...extra,
});

describe('Library.load version upgrades', () => {
    test('upgrades a v0.1 library (no version field) all the way to v0.4', () => {
        const serialized = {
            showImages: true,
            items: [{ id: 5, name: 'Tent', description: '', weight: 1000, authorUnit: 'g', price: 0, image: '', imageUrl: '', url: '' }],
            categories: [{ id: 4, name: 'Shelter', itemIds: [categoryItem(5)] }],
            lists: [{ id: 6, name: 'Trip', categoryIds: ['4'], description: '', externalId: '' }],
            defaultListId: 6,
        };

        const library = new Library();
        library.load(serialized);

        assert.equal(library.version, '0.4');
        // showImages folds into optionalFields (0.2), which then move per-list (0.4)
        assert.equal(library.lists[0].optionalFields.images, true);
        // sequence resumes above the highest existing id
        assert.equal(library.sequence, 7);
        // itemIds renamed to categoryItems
        const category = library.getCategoryById(4);
        assert.equal(category.categoryItems.length, 1);
        assert.equal(category.categoryItems[0].itemId, 5);
        // string categoryIds coerced to ints
        assert.deepEqual(library.lists[0].categoryIds, [4]);
        // the loaded library is fully navigable and computes totals
        const list = library.getListById(library.defaultListId);
        list.calculateTotals();
        assert.equal(list.totalWeight, 1000);
    });

    test('upgrade02to03 reassigns duplicate ids and rewrites references', () => {
        const serialized = {
            version: '0.2',
            items: [{ id: 4, name: 'Stove', description: '', weight: 100, authorUnit: 'g', price: 0, image: '', imageUrl: '', url: '' }],
            categories: [{ id: 4, name: 'Kitchen', categoryItems: [categoryItem(4)] }],
            lists: [{ id: 5, name: 'Trip', categoryIds: [4], description: '', externalId: '' }],
            defaultListId: 5,
        };

        const library = new Library();
        library.load(serialized);

        // the item keeps id 4; the category (second holder of the id) is renumbered
        assert.equal(library.getItemById(4).name, 'Stove');
        const category = library.categories[0];
        assert.notEqual(category.id, 4);
        assert.equal(category.name, 'Kitchen');
        // the list's reference follows the renumbered category
        assert.deepEqual(library.lists[0].categoryIds, [category.id]);
        // the item reference inside the category is untouched
        assert.equal(category.categoryItems[0].itemId, 4);
        assert.equal(library.getCategoryById(category.id), category);
    });
});

describe('Library.load upgrade03to04', () => {
    const serialized03 = (overrides = {}) => ({
        version: '0.3',
        totalUnit: 'oz',
        itemUnit: 'oz',
        defaultListId: 1,
        sequence: 9,
        showSidebar: true,
        optionalFields: {
            images: true, price: true, worn: false, consumable: true, listDescription: false,
        },
        currencySymbol: '$',
        items: [{ id: 4, name: 'Tent', description: '', weight: 1000, authorUnit: 'oz', price: 0, image: '', imageUrl: '', url: '' }],
        categories: [{ id: 2, name: 'Shelter', categoryItems: [categoryItem(4)] }],
        lists: [
            { id: 1, name: 'Trip', categoryIds: [2], description: '', externalId: '' },
            { id: 8, name: 'Other trip', categoryIds: [], description: '', externalId: '' },
        ],
        ...overrides,
    });

    test('copies library settings down to every list and drops the library-level copy', () => {
        const library = new Library();
        library.load(serialized03());

        assert.equal(library.version, '0.4');
        assert.equal(typeof library.optionalFields, 'undefined');
        for (const list of library.lists) {
            assert.deepEqual(list.optionalFields, {
                images: true, price: true, worn: false, consumable: true, listDescription: false,
            });
        }
        // each list owns its settings — no shared object between lists
        assert.notEqual(library.lists[0].optionalFields, library.lists[1].optionalFields);
    });

    test('initializes preferences to defaults', () => {
        const library = new Library();
        library.load(serialized03());
        assert.deepEqual(library.preferences, { sharedItemBubble: true, wornQtyHint: true });
    });

    test('keeps a valid sequence but repairs one behind the max id', () => {
        const ok = new Library();
        ok.load(serialized03({ sequence: 50 }));
        assert.equal(ok.sequence, 50);

        const behind = new Library();
        behind.load(serialized03({ sequence: 3 }));
        assert.equal(behind.sequence, 9); // max id is 8, so 8 + 1
    });

    test('repairs duplicate ids that survived at 0.3', () => {
        const library = new Library();
        library.load(serialized03({
            categories: [{ id: 4, name: 'Shelter', categoryItems: [categoryItem(4)] }],
            lists: [{ id: 1, name: 'Trip', categoryIds: [4], description: '', externalId: '' }],
        }));

        // the item keeps id 4; the category is renumbered and references follow
        assert.equal(library.getItemById(4).name, 'Tent');
        const category = library.categories[0];
        assert.notEqual(category.id, 4);
        assert.deepEqual(library.lists[0].categoryIds, [category.id]);
        assert.equal(category.categoryItems[0].itemId, 4);
    });
});

describe('forward version guard', () => {
    test('refuses to load a library from a newer format', () => {
        const library = new Library();
        assert.throws(
            () => library.load({
                version: '0.5', items: [], categories: [], lists: [],
            }),
            (err) => err.code === 'VERSION_TOO_NEW',
        );
    });
});

describe('per-list settings', () => {
    test('a list created by a pre-0.4 client gets default settings on load', () => {
        const library = new Library();
        const serialized = JSON.parse(JSON.stringify(library.save()));
        delete serialized.lists[0].optionalFields;

        const reloaded = new Library();
        reloaded.load(serialized);

        assert.deepEqual(reloaded.lists[0].optionalFields, {
            images: false, price: false, worn: true, consumable: true, listDescription: false,
        });
    });

    test("worn subtotals follow each list's own settings", () => {
        const library = new Library();
        const listA = library.lists[0];
        const categoryA = library.categories[0];
        const item = library.items[0];
        item.weight = 100;
        categoryA.categoryItems[0].worn = 1;

        const listB = library.newList();
        const categoryB = library.newCategory({ list: listB });
        categoryB.addItem({ itemId: item.id, worn: 1 });
        listB.optionalFields.worn = false;

        listA.calculateTotals();
        listB.calculateTotals();

        assert.equal(listA.totalWornWeight, 100);
        assert.equal(listB.totalWornWeight, 0);
        assert.equal(listB.totalWeight, 100);
    });

    test("copyList copies the source list's settings", () => {
        const library = new Library();
        library.lists[0].optionalFields.price = true;
        library.lists[0].optionalFields.worn = false;

        const copy = library.copyList(library.lists[0].id);

        assert.deepEqual(copy.optionalFields, library.lists[0].optionalFields);
        assert.notEqual(copy.optionalFields, library.lists[0].optionalFields);
    });
});

describe('Category.load repair', () => {
    test('drops dangling categoryItems, including consecutive ones', () => {
        const serialized = {
            version: '0.3',
            sequence: 20,
            defaultListId: 10,
            items: [
                { id: 11, name: 'A', description: '', weight: 1, authorUnit: 'oz', price: 0, image: '', imageUrl: '', url: '' },
                { id: 12, name: 'B', description: '', weight: 1, authorUnit: 'oz', price: 0, image: '', imageUrl: '', url: '' },
            ],
            categories: [{
                id: 13,
                name: 'C',
                categoryItems: [
                    categoryItem(11),
                    categoryItem(98), // dangling
                    categoryItem(99), // dangling, consecutive with the previous one
                    categoryItem(12),
                ],
            }],
            lists: [{ id: 10, name: 'L', categoryIds: [13], description: '', externalId: '' }],
        };

        const library = new Library();
        library.load(serialized);

        const category = library.getCategoryById(13);
        assert.deepEqual(category.categoryItems.map((ci) => ci.itemId), [11, 12]);
    });
});

describe('Library.removeList', () => {
    test('reassigns defaultListId to a surviving list id when the default list is removed', () => {
        const library = new Library(); // firstRun creates the default list
        const firstList = library.lists[0];
        const secondList = library.newList();
        library.newCategory({ list: secondList });

        assert.equal(library.defaultListId, firstList.id);
        library.removeList(firstList.id);

        assert.equal(library.lists.length, 1);
        assert.equal(library.defaultListId, secondList.id);
        assert.equal(library.getListById(library.defaultListId), secondList);
    });

    test('refuses to remove the last remaining list', () => {
        const library = new Library();
        const onlyList = library.lists[0];

        library.removeList(onlyList.id);

        assert.equal(library.lists.length, 1);
        assert.equal(library.defaultListId, onlyList.id);
    });
});

describe('weight and price totals', () => {
    test('worn weight counts an item once regardless of qty; base and pack weights derive correctly', () => {
        const library = new Library();
        const list = library.lists[0];
        const category = library.categories[0];

        const wornItem = library.items[0];
        wornItem.weight = 100;
        category.categoryItems[0].qty = 3;
        category.categoryItems[0].worn = 1;

        const consumableItem = library.newItem({ category });
        consumableItem.weight = 50;
        const consumableCategoryItem = category.getCategoryItemById(consumableItem.id);
        consumableCategoryItem.qty = 2;
        consumableCategoryItem.consumable = true;

        list.calculateTotals();

        assert.equal(list.totalWeight, 400); // 100*3 + 50*2
        assert.equal(list.totalWornWeight, 100); // once, not *3
        assert.equal(list.totalConsumableWeight, 100);
        assert.equal(list.totalBaseWeight, 200); // 400 - (100 + 100)
        assert.equal(list.totalPackWeight, 300); // 400 - 100
        assert.equal(list.totalQty, 5);
    });

    test('worn item with qty 0 contributes no worn weight', () => {
        const library = new Library();
        const list = library.lists[0];
        const category = library.categories[0];

        library.items[0].weight = 100;
        category.categoryItems[0].qty = 0;
        category.categoryItems[0].worn = 1;

        list.calculateTotals();

        assert.equal(list.totalWeight, 0);
        assert.equal(list.totalWornWeight, 0);
    });

    test('price totals multiply by qty', () => {
        const library = new Library();
        const list = library.lists[0];
        const category = library.categories[0];

        library.items[0].price = 19.99;
        category.categoryItems[0].qty = 2;

        list.calculateTotals();

        assert.equal(list.totalPrice, 39.98);
    });
});

describe('Item.load', () => {
    test('coerces string prices to numbers', () => {
        const item = new Item({ id: 1 });
        item.load({ id: 1, price: '12.50' });
        assert.equal(item.price, 12.5);
    });
});

describe('Library.getListsContainingItem', () => {
    test('returns every list whose categories reference the item', () => {
        const library = new Library();
        const firstList = library.lists[0];
        const sharedItem = library.items[0];

        const secondList = library.newList();
        const secondCategory = library.newCategory({ list: secondList });
        secondCategory.addItem({ itemId: sharedItem.id });

        const thirdList = library.newList();
        library.newCategory({ list: thirdList });

        const lists = library.getListsContainingItem(sharedItem.id);
        assert.deepEqual(lists.map((list) => list.id), [firstList.id, secondList.id]);
    });

    test('returns an empty array for an item in no list', () => {
        const library = new Library();
        const orphan = library.newItem({});
        assert.deepEqual(library.getListsContainingItem(orphan.id), []);
    });
});

describe('Library.forkItem', () => {
    test('clones the item for one list and leaves other lists on the original', () => {
        const library = new Library();
        const firstList = library.lists[0];
        const firstCategory = library.categories[0];
        const sharedItem = library.items[0];
        sharedItem.name = 'Tent';
        sharedItem.description = 'Copper Spur';
        sharedItem.weight = 1000;
        sharedItem.price = 450;
        sharedItem.url = 'https://example.com';

        const secondList = library.newList();
        const secondCategory = library.newCategory({ list: secondList });
        secondCategory.addItem({ itemId: sharedItem.id, qty: 2 });

        const itemCount = library.items.length;
        const forked = library.forkItem(sharedItem.id, secondList.id);

        assert.ok(forked);
        assert.notEqual(forked.id, sharedItem.id);
        assert.equal(forked.name, 'Tent');
        assert.equal(forked.description, 'Copper Spur');
        assert.equal(forked.weight, 1000);
        assert.equal(forked.price, 450);
        assert.equal(forked.url, 'https://example.com');
        assert.equal(library.items.length, itemCount + 1);
        assert.equal(library.getItemById(forked.id), forked);

        // The forked list points at the copy; per-list fields are untouched.
        const secondCategoryItem = secondCategory.categoryItems[0];
        assert.equal(secondCategoryItem.itemId, forked.id);
        assert.equal(secondCategoryItem.qty, 2);

        // The original list still references the original item.
        assert.equal(firstCategory.categoryItems[0].itemId, sharedItem.id);
        assert.deepEqual(library.getListsContainingItem(sharedItem.id).map((list) => list.id), [firstList.id]);
        assert.deepEqual(library.getListsContainingItem(forked.id).map((list) => list.id), [secondList.id]);
    });

    test('returns null when the item is not in the given list', () => {
        const library = new Library();
        const item = library.items[0];
        const emptyList = library.newList();

        assert.equal(library.forkItem(item.id, emptyList.id), null);
        assert.equal(library.forkItem(9999, library.lists[0].id), null);
    });
});

describe('serialization safety', () => {
    // Data as an older client saved it: stray UI state (activeHover),
    // long-dead fields (deleteIfEmpty, chart), junk on categoryItems, and a
    // stale displayColor. All of it must round-trip stably: the dirty check
    // compares serialized snapshots, so anything load() normalizes has to
    // come out identically on every save afterwards.
    const legacySerialized = () => ({
        version: '0.3',
        totalUnit: 'oz',
        itemUnit: 'oz',
        defaultListId: 1,
        sequence: 9,
        showSidebar: true,
        optionalFields: {
            images: false, price: false, worn: true, consumable: true, listDescription: false,
        },
        currencySymbol: '$',
        items: [
            { id: 4, name: 'Tent', description: '', weight: 1000, authorUnit: 'oz', price: 0, image: '', imageUrl: '', url: '', deleteIfEmpty: true },
            { id: 5, name: 'Stove', description: '', weight: 500, authorUnit: 'oz', price: 0, image: '', imageUrl: '', url: '' },
        ],
        categories: [
            {
                id: 2,
                name: 'Shelter',
                categoryItems: [categoryItem(4, { obsoleteFlag: 7 })],
                subtotalWeight: 1000, subtotalWornWeight: 0, subtotalConsumableWeight: 0, subtotalPrice: 0, subtotalConsumablePrice: 0, subtotalQty: 1,
                activeHover: true,
            },
            {
                id: 3,
                name: 'Kitchen',
                categoryItems: [categoryItem(5)],
                subtotalWeight: 500, subtotalWornWeight: 0, subtotalConsumableWeight: 0, subtotalPrice: 0, subtotalConsumablePrice: 0, subtotalQty: 1,
                color: { r: 1, g: 2, b: 3 },
                displayColor: 'rgb(9,9,9)', // stale: no longer matches color
            },
        ],
        lists: [
            { id: 1, name: 'Trip', categoryIds: [2, 3], description: '', externalId: '', chart: null },
        ],
    });

    test('a saved library reloads and serializes byte-identically', () => {
        const library = new Library();
        library.load(legacySerialized());
        const first = JSON.stringify(library.save());

        const reloaded = new Library();
        reloaded.load(JSON.parse(first));

        assert.equal(JSON.stringify(reloaded.save()), first);
    });

    test('upgrading the 0.3 fixture moves settings onto the list and stamps 0.4', () => {
        const library = new Library();
        library.load(legacySerialized());

        assert.equal(library.version, '0.4');
        assert.deepEqual(library.lists[0].optionalFields, {
            images: false, price: false, worn: true, consumable: true, listDescription: false,
        });
    });

    test('0.4 save output contains only known fields at every level', () => {
        const library = new Library();
        library.load(legacySerialized());
        const out = library.save();

        assert.deepEqual(Object.keys(out).sort(), ['categories', 'currencySymbol', 'defaultListId', 'itemUnit', 'items', 'lists', 'preferences', 'sequence', 'showSidebar', 'totalUnit', 'version']);
        for (const item of out.items) {
            assert.deepEqual(Object.keys(item).sort(), ['authorUnit', 'description', 'id', 'image', 'imageUrl', 'name', 'price', 'url', 'weight']);
        }
        for (const category of out.categories) {
            const expected = 'color' in category ? ['categoryItems', 'color', 'id', 'name'] : ['categoryItems', 'id', 'name'];
            assert.deepEqual(Object.keys(category).sort(), expected);
            for (const ci of category.categoryItems) {
                assert.deepEqual(Object.keys(ci).sort(), ['consumable', 'itemId', 'qty', 'star', 'worn']);
            }
        }
        for (const list of out.lists) {
            assert.deepEqual(Object.keys(list).sort(), ['categoryIds', 'description', 'externalId', 'id', 'name', 'optionalFields']);
        }
    });
});
