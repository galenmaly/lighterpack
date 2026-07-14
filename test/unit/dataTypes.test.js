import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { Library, Item } from '../../client/dataTypes.js';

const categoryItem = (itemId, extra = {}) => ({
    qty: 1, worn: 0, consumable: false, star: 0, itemId, ...extra,
});

describe('Library.load version upgrades', () => {
    test('upgrades a v0.1 library (no version field) to v0.3', () => {
        const serialized = {
            showImages: true,
            items: [{ id: 5, name: 'Tent', description: '', weight: 1000, authorUnit: 'g', price: 0, image: '', imageUrl: '', url: '' }],
            categories: [{ id: 4, name: 'Shelter', itemIds: [categoryItem(5)] }],
            lists: [{ id: 6, name: 'Trip', categoryIds: ['4'], description: '', externalId: '' }],
            defaultListId: 6,
        };

        const library = new Library();
        library.load(serialized);

        assert.equal(library.version, '0.3');
        assert.equal(library.optionalFields.images, true);
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
