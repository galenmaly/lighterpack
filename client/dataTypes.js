import assignIn from 'lodash/assignIn.js';

import colorUtils from './utils/color.js';
import weightUtils from './utils/weight.js';

const defaultOptionalFields = {
    images: false,
    price: false,
    worn: true,
    consumable: true,
    listDescription: false,
};

const defaultPreferences = {
    sharedItemBubble: true,
};

const Item = function ({ id, unit }) {
    this.id = id;
    this.name = '';
    this.description = '';
    this.weight = 0;
    this.authorUnit = 'oz';
    if (unit) {
        this.authorUnit = unit;
    }
    this.price = 0.00;
    this.image = '';
    this.imageUrl = '';
    this.url = '';

    return this;
};

// save() methods enumerate their fields explicitly: anything unknown is
// dropped at the next save, so junk from older formats can't accumulate.
// Safe because load() refuses versions newer than this code knows.
Item.prototype.save = function () {
    return {
        id: this.id,
        name: this.name,
        description: this.description,
        weight: this.weight,
        authorUnit: this.authorUnit,
        price: this.price,
        image: this.image,
        imageUrl: this.imageUrl,
        url: this.url,
    };
};

Item.prototype.load = function (input) {
    assignIn(this, input);
    if (typeof this.price === 'string') {
        this.price = parseFloat(this.price, 10);
    }
};

const Category = function ({ library, id, _isNew }) {
    this.library = library;
    this.id = id;
    this.name = '';
    this.categoryItems = [];

    this.subtotalWeight = 0;
    this.subtotalWornWeight = 0;
    this.subtotalConsumableWeight = 0;
    this.subtotalPrice = 0;
    this.subtotalConsumablePrice = 0;
    this.subtotalQty = 0;

    this._isNew = _isNew;
    return this;
};

Category.prototype.addItem = function (partialCategoryItem) {
    const tempCategoryItem = {
        qty: 1,
        worn: 0,
        consumable: false,
        star: 0,
        itemId: null,
        _isNew: false,
    };
    assignIn(tempCategoryItem, partialCategoryItem);
    this.categoryItems.push(tempCategoryItem);
};

Category.prototype.updateCategoryItem = function (categoryItem) {
    const oldCategoryItem = this.getCategoryItemById(categoryItem.itemId);
    assignIn(oldCategoryItem, categoryItem);
};

Category.prototype.removeItem = function (itemId) {
    const categoryItem = this.getCategoryItemById(itemId);
    const index = this.categoryItems.indexOf(categoryItem);
    this.categoryItems.splice(index, 1);
};

Category.prototype.calculateSubtotal = function (optionalFields) {
    const fields = optionalFields || defaultOptionalFields;

    this.subtotalWeight = 0;
    this.subtotalWornWeight = 0;
    this.subtotalConsumableWeight = 0;
    this.subtotalPrice = 0;
    this.subtotalConsumablePrice = 0;
    this.subtotalQty = 0;

    for (const i in this.categoryItems) {
        const categoryItem = this.categoryItems[i];
        const item = this.library.getItemById(categoryItem.itemId);
        if (!item) {
            continue;
        }
        this.subtotalWeight += item.weight * categoryItem.qty;
        this.subtotalPrice += item.price * categoryItem.qty;

        if (fields.worn && categoryItem.worn) {
            this.subtotalWornWeight += item.weight * ((categoryItem.qty > 0) ? 1 : 0);
        }
        if (fields.consumable && categoryItem.consumable) {
            this.subtotalConsumableWeight += item.weight * categoryItem.qty;
            this.subtotalConsumablePrice += item.price * categoryItem.qty;
        }
        this.subtotalQty += categoryItem.qty;
    }
};

Category.prototype.getCategoryItemById = function (id) {
    for (const i in this.categoryItems) {
        const categoryItem = this.categoryItems[i];
        if (categoryItem.itemId == id) return categoryItem;
    }
    return null;
};

Category.prototype.getExtendedItemByIndex = function (index) {
    const categoryItem = this.categoryItems[index];
    const item = this.library.getItemById(categoryItem.itemId);
    const extendedItem = assignIn({}, item);
    assignIn(extendedItem, categoryItem);
    return extendedItem;
};

Category.prototype.save = function () {
    const out = {
        id: this.id,
        name: this.name,
        categoryItems: this.categoryItems.map((categoryItem) => ({
            qty: categoryItem.qty,
            worn: categoryItem.worn,
            consumable: categoryItem.consumable,
            star: categoryItem.star,
            itemId: categoryItem.itemId,
        })),
    };
    if (typeof this.color !== 'undefined') {
        out.color = this.color;
    }
    return out;
};

Category.prototype.load = function (input) {
    delete input._isNew;

    assignIn(this, input);

    this.categoryItems = this.categoryItems.filter((categoryItem) => this.library.getItemById(categoryItem.itemId));
    this.categoryItems.forEach((categoryItem) => {
        delete categoryItem._isNew;
        if (typeof categoryItem.price !== 'undefined') {
            delete categoryItem.price;
        }
        if (!categoryItem.star) {
            categoryItem.star = 0;
        }
    });
};

const List = function ({ id, library }) {
    this.library = library;
    this.id = id;
    this.name = '';
    this.categoryIds = [];
    this.chart = null;
    this.description = '';
    this.externalId = '';
    this.optionalFields = assignIn({}, defaultOptionalFields);

    this.totalWeight = 0;
    this.totalWornWeight = 0;
    this.totalConsumableWeight = 0;
    this.totalBaseWeight = 0;
    this.totalPackWeight = 0;
    this.totalPrice = 0;
    this.totalConsumablePrice = 0;
    this.totalQty = 0;

    return this;
};

List.prototype.addCategory = function (categoryId) {
    this.categoryIds.push(categoryId);
};

List.prototype.removeCategory = function (categoryId) {
    categoryId = parseInt(categoryId);
    let index = this.categoryIds.indexOf(categoryId);
    if (index == -1) {
        index = this.categoryIds.indexOf(`${categoryId}`);
        if (index == -1) {
            console.warn(`Unable to delete category, it does not exist in this list:${categoryId}`);
            return false;
        }
    }

    this.categoryIds.splice(index, 1);
    return true;
};

List.prototype.renderChart = function (type, linkParent) {
    const chartData = { points: {} };
    let total = 0;

    if (typeof linkParent === 'undefined') linkParent = true;

    for (const i in this.categoryIds) {
        const category = this.library.getCategoryById(this.categoryIds[i]);
        if (category) {
            category.calculateSubtotal(this.optionalFields);

            if (type === 'consumable') {
                total += category.subtotalConsumableWeight;
            } else if (type === 'worn') {
                total += category.subtotalWornWeight;
            } else if (type === 'base') {
                total += (category.subtotalWeight - (category.subtotalConsumableWeight + category.subtotalWornWeight));
            } else { // total weight
                total += category.subtotalWeight;
            }
        }
    }

    if (!total) return false;

    const getTooltipText = function (name, valueMg, unit) {
        return `${name}: ${weightUtils.MgToWeight(valueMg, unit)} ${unit}`;
    };

    for (const i in this.categoryIds) {
        const category = this.library.getCategoryById(this.categoryIds[i]);
        if (category) {
            const points = {};

            let categoryTotal;
            if (type === 'consumable') {
                categoryTotal = category.subtotalConsumableWeight;
            } else if (type === 'worn') {
                categoryTotal = category.subtotalWornWeight;
            } else if (type === 'base') {
                categoryTotal = (category.subtotalWeight - (category.subtotalConsumableWeight + category.subtotalWornWeight));
            } else { // total weight
                categoryTotal = category.subtotalWeight;
            }

            const tempColor = category.color || colorUtils.getColor(i);
            category.displayColor = colorUtils.rgbToString(tempColor);
            const tempCategory = {};

            for (const j in category.categoryItems) {
                const item = category.getExtendedItemByIndex(j);
                let value = item.weight * item.qty;
                if (!value) value = 0;
                let name = getTooltipText(item.name, value, item.authorUnit);
                const color = colorUtils.getColor(j, tempColor);
                if (item.qty > 1) name += ` x ${item.qty}`;
                const percent = value / categoryTotal;
                const tempItem = {
                    value, id: item.id, name, color, percent,
                };
                if (linkParent) tempItem.parent = tempCategory;
                points[j] = tempItem;
            }
            const percent = categoryTotal / total;
            const tempCategoryData = {
                points, color: category.color, id: category.id, name: getTooltipText(category.name, categoryTotal, this.library.totalUnit), total: categoryTotal, percent, visiblePoints: false,
            };
            if (linkParent) tempCategoryData.parent = chartData;
            assignIn(tempCategory, tempCategoryData);
            chartData.points[i] = tempCategory;
        }
    }
    chartData.total = total;

    return chartData;
};

List.prototype.calculateTotals = function () {
    let totalWeight = 0;
    let totalPrice = 0;
    let totalWornWeight = 0;
    let totalConsumableWeight = 0;
    let totalConsumablePrice = 0;
    let totalBaseWeight = 0;
    let totalPackWeight = 0;
    let totalQty = 0;
    const out = { categories: [] };

    for (const i in this.categoryIds) {
        const category = this.library.getCategoryById(this.categoryIds[i]);

        if (category) {
            category.calculateSubtotal(this.optionalFields);

            totalWeight += category.subtotalWeight;
            totalWornWeight += category.subtotalWornWeight;
            totalConsumableWeight += category.subtotalConsumableWeight;

            totalPrice += category.subtotalPrice;
            totalConsumablePrice += category.subtotalConsumablePrice;

            totalQty += category.subtotalQty;

            out.categories.push(category);
        }
    }

    totalBaseWeight = totalWeight - (totalWornWeight + totalConsumableWeight);
    totalPackWeight = totalWeight - totalWornWeight;

    this.totalWeight = totalWeight;
    this.totalWornWeight = totalWornWeight;
    this.totalConsumableWeight = totalConsumableWeight;

    this.totalBaseWeight = totalBaseWeight;
    this.totalPackWeight = totalPackWeight;

    this.totalPrice = totalPrice;
    this.totalConsumablePrice = totalConsumablePrice;

    this.totalQty = totalQty;
};

List.prototype.save = function () {
    return {
        id: this.id,
        name: this.name,
        categoryIds: this.categoryIds.slice(),
        description: this.description,
        externalId: this.externalId,
        optionalFields: assignIn({}, this.optionalFields),
    };
};

List.prototype.load = function (input) {
    assignIn(this, input);
    // A list created by a pre-0.4 client may lack per-list settings.
    this.optionalFields = assignIn({}, defaultOptionalFields, input.optionalFields);
    this.calculateTotals();
};

const Library = function () {
    this.version = '0.4';
    this.idMap = {};
    this.items = [];
    this.categories = [];
    this.lists = [];
    this.sequence = 0;
    this.defaultListId = 1;
    this.totalUnit = 'oz';
    this.itemUnit = 'oz';
    this.showSidebar = true;
    this.preferences = assignIn({}, defaultPreferences);
    this.currencySymbol = '$';
    this.firstRun();
    return this;
};


Library.prototype.firstRun = function () {
    const firstList = this.newList();
    const firstCategory = this.newCategory({ list: firstList });
    this.newItem({ category: firstCategory });
};

Library.prototype.newItem = function ({ category, _isNew }) {
    const temp = new Item({ id: this.nextSequence(), unit: this.itemUnit });
    this.items.push(temp);
    this.idMap[temp.id] = temp;
    if (category) {
        category.addItem({ itemId: temp.id, _isNew });
    }
    return temp;
};

Library.prototype.updateItem = function (item) {
    const oldItem = this.getItemById(item.id);
    assignIn(oldItem, item);
    return oldItem;
};

Library.prototype.removeItem = function (id) {
    const item = this.getItemById(id);
    for (const i in this.lists) {
        const category = this.findCategoryWithItemById(id, this.lists[i].id);
        if (category) {
            category.removeItem(id);
        }
    }

    this.items.splice(this.items.indexOf(item), 1);
    delete this.idMap[id];

    return true;
};

Library.prototype.newCategory = function ({ list, _isNew }) {
    const temp = new Category({ id: this.nextSequence(), _isNew, library: this });

    this.categories.push(temp);
    this.idMap[temp.id] = temp;
    if (list) {
        list.addCategory(temp.id);
    }

    return temp;
};

Library.prototype.removeCategory = function (id, force) {
    const category = this.getCategoryById(id);
    const list = this.findListWithCategoryById(id);

    if (list && list.categoryIds.length == 1 && !force) {
        alert("Can't remove the last category in a list!");
        return false;
    }

    if (list) {
        list.removeCategory(id);
    }

    this.categories.splice(this.categories.indexOf(category), 1);
    delete this.idMap[id];

    return true;
};

Library.prototype.newList = function () {
    const temp = new List({ id: this.nextSequence(), library: this });
    this.lists.push(temp);
    this.idMap[temp.id] = temp;
    if (!this.defaultListId) this.defaultListId = temp.id;
    return temp;
};

Library.prototype.removeList = function (id) {
    if (Object.size(this.lists) == 1) return;
    const list = this.getListById(id);

    for (let i = 0; i < list.categoryIds.length; i++) {
        this.removeCategory(list.categoryIds[i], true);
    }

    this.lists.splice(this.lists.indexOf(list), 1);
    delete this.idMap[id];

    if (this.defaultListId == id) {
        this.defaultListId = this.lists[0].id;
    }
};

Library.prototype.copyList = function (id) {
    const oldList = this.getListById(id);
    if (!oldList) return;

    const copiedList = this.newList();

    copiedList.name = `Copy of ${oldList.name}`;
    copiedList.optionalFields = assignIn({}, oldList.optionalFields);
    for (const i in oldList.categoryIds) {
        const oldCategory = this.getCategoryById(oldList.categoryIds[i]);
        const copiedCategory = this.newCategory({ list: copiedList });

        copiedCategory.name = oldCategory.name;

        for (const j in oldCategory.categoryItems) {
            copiedCategory.addItem(oldCategory.categoryItems[j]);
        }
    }

    return copiedList;
};

Library.prototype.renderChart = function (type) {
    return this.getListById(this.defaultListId).renderChart(type);
};

Library.prototype.getCategoryById = function (id) {
    return this.idMap[id];
};

Library.prototype.getItemById = function (id) {
    return this.idMap[id];
};

Library.prototype.getListById = function (id) {
    return this.idMap[id];
};

Library.prototype.getItemsInCurrentList = function () {
    const out = [];
    const list = this.getListById(this.defaultListId);
    for (let i = 0; i < list.categoryIds.length; i++) {
        const category = this.getCategoryById(list.categoryIds[i]);
        if (category) {
            for (const j in category.categoryItems) {
                const categoryItem = category.categoryItems[j];
                out.push(categoryItem.itemId);
            }
        }
    }
    return out;
};

Library.prototype.findCategoryWithItemById = function (itemId, listId) {
    if (listId) {
        const list = this.getListById(listId);
        for (const i in list.categoryIds) {
            const category = this.getCategoryById(list.categoryIds[i]);
            if (category) {
                for (const j in category.categoryItems) {
                    const categoryItem = category.categoryItems[j];
                    if (categoryItem.itemId == itemId) return category;
                }
            }
        }
    } else {
        for (const i in this.categories) {
            const category = this.categories[i];
            if (category) {
                for (const j in category.categoryItems) {
                    const categoryItem = category.categoryItems[j];
                    if (categoryItem.itemId == itemId) return category;
                }
            }
        }
    }
};

Library.prototype.getListsContainingItem = function (itemId) {
    const out = [];
    for (const i in this.lists) {
        const list = this.lists[i];
        if (this.findCategoryWithItemById(itemId, list.id)) {
            out.push(list);
        }
    }
    return out;
};

// Detaches one list's use of a shared item into an independent copy: the
// item's fields are cloned onto a new item and the list's categoryItem is
// repointed at it. Other lists keep referencing the original.
Library.prototype.forkItem = function (itemId, listId) {
    const item = this.getItemById(itemId);
    const category = this.findCategoryWithItemById(itemId, listId);
    if (!item || !category) return null;

    const newItem = this.newItem({});
    const newId = newItem.id;
    assignIn(newItem, item);
    newItem.id = newId;

    const categoryItem = category.getCategoryItemById(itemId);
    categoryItem.itemId = newId;

    return newItem;
};

Library.prototype.findListWithCategoryById = function (id) {
    for (const i in this.lists) {
        const list = this.lists[i];
        for (const j in list.categoryIds) {
            if (list.categoryIds[j] == id) return list;
        }
    }
};

Library.prototype.nextSequence = function () {
    return ++this.sequence;
};

Library.prototype.save = function () {
    const out = {};

    out.version = this.version;
    out.totalUnit = this.totalUnit;
    out.itemUnit = this.itemUnit;
    out.defaultListId = this.defaultListId;
    out.sequence = this.sequence;
    out.showSidebar = this.showSidebar;
    out.preferences = assignIn({}, this.preferences);
    out.currencySymbol = this.currencySymbol;

    out.items = [];
    for (const i in this.items) {
        out.items.push(this.items[i].save());
    }

    out.categories = [];
    for (const i in this.categories) {
        out.categories.push(this.categories[i].save());
    }

    out.lists = [];
    for (const i in this.lists) {
        out.lists.push(this.lists[i].save());
    }

    return out;
};

Library.prototype.load = function (serializedLibrary) {
    // upgrades should update "serializedLibrary" in-place instead of modifying "this"
    if (serializedLibrary.version === '0.1' || !serializedLibrary.version) {
        this.upgrade01to02(serializedLibrary);
    }
    if (serializedLibrary.version === '0.2') {
        this.upgrade02to03(serializedLibrary);
    }
    if (serializedLibrary.version === '0.3') {
        this.upgrade03to04(serializedLibrary);
    }
    if (serializedLibrary.version !== '0.4') {
        // Forward guard: never load (and later save, mangled) data written
        // by a newer format than this code knows.
        const err = new Error(`This library was saved by a newer version of LighterPack (${serializedLibrary.version}). Please refresh your browser.`);
        err.code = 'VERSION_TOO_NEW';
        throw err;
    }

    this.items = [];

    this.preferences = assignIn({}, defaultPreferences, serializedLibrary.preferences);

    for (const i in serializedLibrary.items) {
        const temp = new Item({ id: serializedLibrary.items[i].id });
        temp.load(serializedLibrary.items[i]);
        this.items.push(temp);
        this.idMap[temp.id] = temp;
    }

    this.categories = [];
    for (const i in serializedLibrary.categories) {
        const temp = new Category({ id: serializedLibrary.categories[i].id, library: this });
        temp.load(serializedLibrary.categories[i]);
        this.categories.push(temp);
        this.idMap[temp.id] = temp;
    }

    this.lists = [];
    for (const i in serializedLibrary.lists) {
        const temp = new List({ id: serializedLibrary.lists[i].id, library: this });
        temp.load(serializedLibrary.lists[i]);
        this.lists.push(temp);
        this.idMap[temp.id] = temp;
    }

    if (serializedLibrary.showSidebar) this.showSidebar = serializedLibrary.showSidebar;
    if (serializedLibrary.totalUnit) this.totalUnit = serializedLibrary.totalUnit;
    if (serializedLibrary.itemUnit) this.itemUnit = serializedLibrary.itemUnit;
    if (serializedLibrary.currencySymbol) this.currencySymbol = serializedLibrary.currencySymbol;

    this.version = serializedLibrary.version;
    this.sequence = serializedLibrary.sequence;
    this.defaultListId = serializedLibrary.defaultListId;
};

Library.prototype.upgrade01to02 = function (serializedLibrary) {
    if (!serializedLibrary.optionalFields) {
        serializedLibrary.optionalFields = assignIn({}, defaultOptionalFields);
    }

    if (serializedLibrary.showImages) {
        serializedLibrary.optionalFields.images = true;
    } else {
        serializedLibrary.optionalFields.images = false;
    }
    serializedLibrary.version = '0.2';
};

Library.prototype.upgrade02to03 = function (serializedLibrary) {
    this.sequenceShouldBeCorrect(serializedLibrary);
    this.idsShouldBeInts(serializedLibrary);
    this.renameCategoryIds(serializedLibrary);
    this.fixDuplicateIds(serializedLibrary);
    serializedLibrary.version = '0.3';
};

Library.prototype.upgrade03to04 = function (serializedLibrary) {
    // 0.3 never re-ran the id repairs, so 0.3 libraries exist in the wild
    // with duplicate ids and sequences behind their max id.
    this.sequenceShouldNotRegress(serializedLibrary);
    this.fixDuplicateIds(serializedLibrary);

    // Display settings move from the library to each list.
    const libraryFields = assignIn({}, defaultOptionalFields, serializedLibrary.optionalFields);
    serializedLibrary.lists.forEach((list) => {
        list.optionalFields = assignIn({}, libraryFields);
    });
    delete serializedLibrary.optionalFields;

    serializedLibrary.preferences = assignIn({}, defaultPreferences);
    serializedLibrary.version = '0.4';
};

// Unlike sequenceShouldBeCorrect, never lowers a valid sequence — only
// repairs ones that could mint colliding ids.
Library.prototype.sequenceShouldNotRegress = function (serializedLibrary) {
    let maxId = 0;
    const consider = (entity) => {
        if (typeof entity.id === 'number' && entity.id > maxId) maxId = entity.id;
    };
    serializedLibrary.lists.forEach(consider);
    serializedLibrary.categories.forEach(consider);
    serializedLibrary.items.forEach(consider);

    if (typeof serializedLibrary.sequence !== 'number' || !Number.isFinite(serializedLibrary.sequence) || serializedLibrary.sequence < maxId) {
        serializedLibrary.sequence = maxId + 1;
    }
};

Library.prototype.sequenceShouldBeCorrect = function (serializedLibrary) {
    let sequence = 0;

    serializedLibrary.lists.forEach((list) => {
        if (list.id > sequence) {
            sequence = list.id;
        }
    });

    serializedLibrary.categories.forEach((category) => {
        if (category.id > sequence) {
            sequence = category.id;
        }
    });

    serializedLibrary.items.forEach((item) => {
        if (item.id > sequence) {
            sequence = item.id;
        }
    });
    serializedLibrary.sequence = (sequence + 1);
};

Library.prototype.idsShouldBeInts = function (serializedLibrary) {
    // Some lists of Ids were strings previously. They should be numbers.
    serializedLibrary.lists.forEach((list) => {
        list.categoryIds = list.categoryIds.map(categoryId => parseInt(categoryId, 10));
    });
};

Library.prototype.renameCategoryIds = function (serializedLibrary) {
    // categoryIds was previously itemIds. Renaming for clarity.
    serializedLibrary.categories.forEach((category) => {
        if (typeof category.itemIds !== 'undefined') {
            if (!category.categoryItems || category.categoryItems.length === 0) {
                category.categoryItems = category.itemIds;
                delete category.itemIds;
            } else {
                delete category.itemIds;
            }
        }
        if (typeof category.categoryItems === 'undefined') {
            category.categoryItems = [];
        }
    });
};

Library.prototype.fixDuplicateIds = function (serializedLibrary) {
    const foundIds = {};

    serializedLibrary.items.forEach((item) => {
        if (!foundIds[item.id]) {
            foundIds[item.id] = [];
        }
        foundIds[item.id].push({ type: 'item', item });
    });

    serializedLibrary.categories.forEach((category) => {
        if (!foundIds[category.id]) {
            foundIds[category.id] = [];
        }
        foundIds[category.id].push({ type: 'category', category });
    });

    serializedLibrary.lists.forEach((list) => {
        if (!foundIds[list.id]) {
            foundIds[list.id] = [];
        }
        foundIds[list.id].push({ type: 'list', list });
    });

    for (const id in foundIds) {
        if (foundIds[id].length > 1) {
            const duplicateSet = foundIds[id];
            duplicateSet.forEach((duplicate, index) => {
                if (index === 0) {
                    return;
                }
                if (duplicate.type === 'item') {
                    this.updateItemId(serializedLibrary, duplicate.item, ++serializedLibrary.sequence);
                } else if (duplicate.type === 'category') {
                    this.updateCategoryId(serializedLibrary, duplicate.category, ++serializedLibrary.sequence);
                } else if (duplicate.type === 'list') {
                    this.updateListId(serializedLibrary, duplicate.list, ++serializedLibrary.sequence);
                }
            });
        }
    }
};

Library.prototype.updateListId = function (serializedLibrary, list, newId) {
    list.id = newId;
};
Library.prototype.updateCategoryId = function (serializedLibrary, category, newId) {
    const oldId = category.id;

    category.id = newId;

    serializedLibrary.lists.forEach((list) => {
        list.categoryIds.forEach((categoryId, index) => {
            if (categoryId === oldId) {
                list.categoryIds[index] = newId;
            }
        });
    });
};

Library.prototype.updateItemId = function (serializedLibrary, item, newId) {
    const oldId = item.id;

    item.id = newId;

    serializedLibrary.categories.forEach((category) => {
        category.categoryItems.forEach((categoryItem) => {
            if (categoryItem.itemId === oldId) {
                categoryItem.itemId = newId;
            }
        });
    });
};

Object.size = function (obj) {
    let size = 0; let
        key;
    for (key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) size++;
    }
    return size;
};

export { Library, List, Category, Item };
