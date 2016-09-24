if (typeof $ != "undefined") {
    extend = $.extend;
}

Item = function(args) {
    this.id = args.id;
    this.name = "";
    this.description = "";
    this.weight = 0;
    this.authorUnit = "oz";
    if (args.unit) this.authorUnit = args.unit;
    this.image = "";
    this.url = "";
    return this;
}

Item.prototype.render = function(args) {
    var classes = "";
    if (args.classes) classes = args.classes;
    if (this.deleteIfEmpty) classes += " deleteIfEmpty";

    var unit = this.authorUnit;
    if (args.unit) unit = args.unit;

    var showImages = false;
    if (args.showImages) showImages = true;

    var displayWeight = MgToWeight(this.weight, unit);

    var unitSelect = renderUnitSelect(unit, args.unitSelectTemplate, this.weight);

    var starClass = this.star ? "lpStar" + this.star : "";
    var out = {classes: classes, unit: unit, displayWeight: displayWeight, unitSelect: unitSelect, showImages: showImages, starClass: starClass};
    extend(out, this);

    return Mustache.render(args.itemTemplate, out);
}

Item.prototype.save = function() {
    return this;
}

Item.prototype.load = function(input) {
    extend(this, input);
}

Category = function(args) {
    this.library = args.library;
    this.id = args.id;
    this.name = "";
    this.itemIds = []; //this is actual items, not itemIds. Rename?
    return this;
}

Category.prototype.addItem = function (args) {
    var temp = {
        qty: 1,
        worn: 0,
        consumable: false,
        star: 0,
        itemId: null
    }
    extend(temp, args);
    this.itemIds.push(temp);
}

Category.prototype.removeItem = function (itemId) {
    var categoryItem = this.getCategoryItemById(itemId);
    var index = this.itemIds.indexOf(categoryItem);
    this.itemIds.splice(index,1);
}

Category.prototype.calculateSubtotal = function() {
    this.subtotal = 0;
    this.wornSubtotal = 0;
    this.consumableSubtotal = 0;
    this.qtySubtotal = 0;
    for (var i in this.itemIds) {
        var categoryItem = this.itemIds[i];
        var item = this.library.getItemById(categoryItem.itemId);
        this.subtotal += item.weight*categoryItem.qty;
        if (categoryItem.worn) {
            this.wornSubtotal += item.weight * ( (item.qty > 0) ? 1 : 0 );
        }
        if (categoryItem.consumable) {
            this.consumableSubtotal += item.weight * item.qty;
        }
        this.qtySubtotal += item.qty;
    }
}

Category.prototype.render = function (args) {
    var items = "";
    for (var i in this.itemIds) {
        var categoryItem = this.itemIds[i];
        var item = this.library.getItemById(categoryItem.itemId);
        extend(item, categoryItem);
        items += item.render(args);
    }

    this.calculateSubtotal();
    this.displaySubtotal = MgToWeight(this.subtotal, args.totalUnit);

    var temp = extend({}, this, {items:items, subtotalUnit: args.totalUnit});

    return Mustache.render(args.categoryTemplate, temp);
}

Category.prototype.getCategoryItemById = function(id) {
    for (var i in this.itemIds) {
        var categoryItem = this.itemIds[i];
        if (categoryItem.itemId == id) return categoryItem;
    }
    return null;
}

Category.prototype.getExtendedItemByIndex = function(index) {
    var categoryItem = this.itemIds[index];
    var item = this.library.getItemById(categoryItem.itemId);
    extend(item, categoryItem);
    return item;
}

Category.prototype.save = function() {
    var out = extend({}, this);
    delete out.library;
    delete out.template;
    return out;
}

Category.prototype.load = function(input) {
    extend(this, input);
}


List = function(args) {
    this.library = args.library;
    this.id = args.id;
    this.name = "";
    this.categoryIds = [];
    this.chart = null;
    return this;
}

List.prototype.addCategory = function (categoryId) {
    this.categoryIds.push(categoryId);
}

List.prototype.removeCategory = function (categoryId) {
    categoryId = parseInt(categoryId);
    var index = this.categoryIds.indexOf(categoryId);
    if (index == -1) {
        index = this.categoryIds.indexOf(""+categoryId);
        if (index == -1) {
            console.warn("Unable to delete category, it does not exist in this list:"+categoryId);
            return false;
        }
    }

    this.categoryIds.splice(index,1);
    return true;
}

List.prototype.render = function (args) {
    var out = "";
    for (var i in this.categoryIds) {
        var category = this.library.getCategoryById(this.categoryIds[i]);
        if (category) out += category.render(args);
    }
    return out;
}

List.prototype.renderChart = function (type, linkParent) {
    var chartData = { points: {}};
    var total = 0;

    if (typeof linkParent == "undefined") linkParent = true;

    for (var i in this.categoryIds) {
        var category = this.library.getCategoryById(this.categoryIds[i]);
        if (category) {
            category.calculateSubtotal();

            if (type === 'consumable') {
              total += category.consumableSubtotal;
            } else if (type === 'worn') {
              total += category.wornSubtotal;
            } else if (type === 'base') {
              total += (category.subtotal - (category.consumableSubtotal + category.wornSubtotal));
            } else { //total weight
              total += category.subtotal;
            }
        }
    }

    if (!total) return false;

    for (var i in this.categoryIds) {
        var category = this.library.getCategoryById(this.categoryIds[i]);
        if (category) {
            var points = {};

            var categoryTotal;
            if (type === 'consumable') {
              categoryTotal = category.consumableSubtotal;
            } else if (type === 'worn') {
              categoryTotal = category.wornSubtotal;
            } else if (type === 'base') {
              categoryTotal = (category.subtotal - (category.consumableSubtotal + category.wornSubtotal));
            } else { //total weight
              categoryTotal = category.subtotal;
            }

            var tempColor = category.color || getColor(i);
            category.displayColor = rgbToString(tempColor);
            var tempCategory = {};

            for (var j in category.itemIds) {
                var item = category.getExtendedItemByIndex(j);
                var value = item.weight * item.qty
                var name = item.name;
                var color = getColor(j, tempColor);
                if (item.qty > 1) name += " x "+item.qty;
                if (!value) value = 0;
                var percent = value / categoryTotal;
                var tempItem =  { value: value, id: item.id, name: name, color: color, percent: percent };
                if (linkParent) tempItem.parent = tempCategory;
                points[j] = tempItem;
            }
            var percent = categoryTotal / total;
            var tempCategoryData = {points: points, color: category.color, id:category.id, name:category.name, total: categoryTotal, percent: percent, visiblePoints: false};
            if (linkParent) tempCategoryData.parent = chartData;
            extend(tempCategory, tempCategoryData);
            chartData.points[i] = tempCategory;
        }
    }
    chartData.total = total;

    return chartData;
}

List.prototype.renderTotals = function(totalsTemplate, unitSelectTemplate, unit) {
    var total = 0,
        wornTotal = 0,
        consumableTotal = 0,
        packTotal = 0,
        qtyTotal = 0,
        out = {categories: []};

    for (var i in this.categoryIds) {
        var category = this.library.getCategoryById(this.categoryIds[i]);
        category.calculateSubtotal();
        category.displaySubtotal = MgToWeight(category.subtotal, unit);
        category.subtotalUnit = unit;

        total += category.subtotal;
        wornTotal += category.wornSubtotal;
        consumableTotal += category.consumableSubtotal;
        qtyTotal += category.qtySubtotal;
        out.categories.push(category);
    }

    packTotal = total - (wornTotal + consumableTotal);
    out.total = MgToWeight(total, unit);
    out.totalUnit = renderUnitSelect(unit, unitSelectTemplate, total);
    out.subtotalUnit = unit;
    out.wornTotal = wornTotal;
    out.wornDisplayTotal = MgToWeight(wornTotal, unit);
    out.consumableTotal = consumableTotal;
    out.consumableDisplayTotal = MgToWeight(consumableTotal, unit);
    out.packTotal = packTotal;
    out.packDisplayTotal = MgToWeight(packTotal, unit);
    out.qtyTotal = qtyTotal;

    return Mustache.render(totalsTemplate, out);
}

List.prototype.save = function() {
    var out = extend({}, this);
    delete out.library;
    delete out.chart;
    return out;
}

List.prototype.load = function(input) {
    extend(this, input);
}

Library = function(args) {
    this.version = "0.2";
    this.items = {};
    this.categories = {};
    this.lists = {};
    this.sequence = 0;
    this.defaultListId = 1;
    this.totalUnit = "oz";
    this.itemUnit = "oz";
    this.showSidebar = true;
    this.showImages = false;
    this.optionalFields = {
            images: false,
            worn: true,
            consumable: true
        };
    this.firstRun();
    return this;
}


Library.prototype.firstRun = function() {
    var firstList = this.newList();
    var firstCategory = this.newCategory({list: firstList});
    var firstItem = this.newItem({category: firstCategory});
}

Library.prototype.newItem = function(args) {
    var temp = new Item({id: this.nextSequence(), library: this, unit: this.itemUnit});
    this.items[temp.id] = temp;
    if (args.category) args.category.addItem({itemId: temp.id});
    return temp;
}

Library.prototype.removeItem = function(id) {
    for (var i in this.lists) {
        var category = this.findCategoryWithItemById(id, i);
        if (category) {
            category.removeItem(id);
        }
    }

    delete this.items[id];
    return true;
}

Library.prototype.newCategory = function(args) {
    var temp = new Category({id: this.nextSequence(), library: this});
    this.categories[temp.id] = temp;
    if (args.list) args.list.addCategory(temp.id);
    return temp;
}

Library.prototype.removeCategory = function(id, force) {
    var category = this.getCategoryById(id);

    var list = this.findListWithCategoryById(id);
    if (list && list.categoryIds.length == 1 && !force) {
        alert("Can't remove the last category in a list!");
        return false;
    } else if (list) {
        var result = list.removeCategory(id);
        if (result) {
            delete this.categories[id];
            return true;    
        } else {
            return false;
        }
    }

    delete this.categories[id];
    return true;    
}


Library.prototype.newList = function() {
    var temp = new List({id: this.nextSequence(), library: this});
    this.lists[temp.id] = temp;
    if (!this.defaultListId) this.defaultListId = temp.id;
    return temp;
}

Library.prototype.removeList = function(id) {
    if (Object.size(this.lists) == 1) return;
    var list = this.getListById(id);

    for (var i = 0; i < list.categoryIds; i++) {
        this.removeCategory(list.categoryIds[i], true);
    }

    delete this.lists[id];

    if (this.defaultListId == id) {
        var newId = -1;
        for (var i in lists) {
            newId = i;
            break;
        }
        this.defaultListId = newId;
    }
}

Library.prototype.copyList = function(id) {
    var oldList = this.getListById(id);
    if (!oldList) return;

    copiedList = this.newList();

    copiedList.name = "Copy of " + oldList.name;
    for (var i in oldList.categoryIds) {
        var oldCategory = this.getCategoryById(oldList.categoryIds[i]),
            copiedCategory = this.newCategory({list: copiedList});

        copiedCategory.name = oldCategory.name;

        for (var j in oldCategory.itemIds) {
            copiedCategory.addItem(oldCategory.itemIds[j]);
        }
    }

    return copiedList;
}

Library.prototype.render = function(args) {
    extend(args, {itemUnit: this.itemUnit, totalUnit: this.totalUnit})
    return this.lists[this.defaultListId].render(args);
}

Library.prototype.renderLists = function(template) {
    var out = "";
    for (var i in this.lists) {
        var list = this.lists[i];
        out += Mustache.render(template, list);
    }
    return out
}

Library.prototype.renderLibrary = function(template) {
    var out = "";
    var itemsInCurrentList = this.getItemsInCurrentList();
    for (var i in this.items) {
        var item = this.items[i]
        var temp = {itemInCurrentList: false};
        if (itemsInCurrentList.indexOf(item.id) > -1) temp.itemInCurrentList = true;
        extend(temp, item)
        out += item.render({itemTemplate: template});
    }
    return out;
}

Library.prototype.renderChart = function(type) {
    return this.lists[this.defaultListId].renderChart(type);
}

Library.prototype.renderTotals = function(totalsTemplate, unitSelectTemplate) {
    return this.lists[this.defaultListId].renderTotals(totalsTemplate, unitSelectTemplate, this.totalUnit);
}

Library.prototype.getCategoryById = function(id) {
    return this.categories[id];
}

Library.prototype.getItemById = function(id) {
    return this.items[id];
}

Library.prototype.getListById = function(id) {
    return this.lists[id];
}

Library.prototype.getItemsInCurrentList = function() {
    var out = [];
    var list = this.lists[this.defaultListId];
    for (var i in list.categoryIds) {
        var category = this.getCategoryById(list.categoryIds[i]);
        if (category) {
            for (var j in category.itemIds) {
                var categoryItem = category.itemIds[j];
                out.push(categoryItem.itemId);
            }
        }
    }
    return out;
}

Library.prototype.findCategoryWithItemById = function(itemId, listId) {
    if (listId) {
        var list = this.getListById(listId);
        for (i in list.categoryIds) {
            var category = this.getCategoryById(list.categoryIds[i]);
            if (category) {
                for (var j in category.itemIds) {
                    var categoryItem = category.itemIds[j];
                    if (categoryItem.itemId == itemId) return category;
                }
            }
        }
    } else {
        for (var i in this.categories) {
            var category = this.categories[i];
            if (category) {
                for (var j in category.itemIds) {
                    var categoryItem = category.itemIds[j];
                    if (categoryItem.itemId == itemId) return category;
                }
            }
        }
    }
}

Library.prototype.findListWithCategoryById = function(id) {
     for (var i in this.lists) {
        var list = this.lists[i];
        for (var j in list.categoryIds) {
            if ( list.categoryIds[j] == id) return list;
        }
    }
}

Library.prototype.findSequence = function() {
    var list = this.getListById(this.defaultListId);
    for (var i in list.categories) {
        var category = list.categories[i];
        for (var j in category.items) {
            var item = category.items[j];
            if (item.id && item.id > sequence) {
                sequence = item.id;
            }
        }
    }
}

Library.prototype.nextSequence = function() {
    return ++this.sequence;
}

Library.prototype.save = function() {
    var out = {};

    out.version = this.version;
    out.totalUnit = this.totalUnit;
    out.itemUnit = this.itemUnit;
    out.defaultListId = this.defaultListId;
    out.sequence = this.sequence;
    out.showSidebar = this.showSidebar;
    out.optionalFields = this.optionalFields;

    out.items = [];
    for (var i in this.items) {
        out.items.push(this.items[i].save());
    }

    out.categories = [];
    for (var i in this.categories) {
        out.categories.push(this.categories[i].save());
    }

    out.lists = [];
    for (var i in this.lists) {
        out.lists.push(this.lists[i].save());
    }

    return out;
}

Library.prototype.load = function(input) {
    this.items = [];

    extend(this.optionalFields, input.optionalFields);

    for (var i in input.items) {
        var temp = new Item({id: input.items[i].id, library: this});
        temp.load(input.items[i]);
        this.items[temp.id] = temp;
    }

    this.categories = [];
    for (var i in input.categories) {
        var temp = new Category({id: input.categories[i].id, library: this});
        temp.load(input.categories[i]);
        this.categories[temp.id] = temp;
    }

    this.lists = [];
    for (var i in input.lists) {
        var temp = new List({id: input.lists[i].id, library: this});
        temp.load(input.lists[i]);
        this.lists[temp.id] = temp;
    }

    if (input.showSidebar) this.showSidebar = input.showSidebar;
    if (input.totalUnit) this.totalUnit = input.totalUnit;
    if (input.itemUnit) this.itemUnit = input.itemUnit;
    this.sequence = input.sequence;
    this.defaultListId = input.defaultListId;

    if (input.version === "0.1" || !input.version) {
        this.upgrade01to02(input);
    }
}

Library.prototype.upgrade01to02 = function(input) {
    if (input.showImages) {
        this.optionalFields.images = true;
    } else {
        this.optionalFields.images = false;
    }
}

function WeightToMg(value, unit) {
    if (unit == "g") {
        return value*1000;
    } else if (unit == "kg") {
        return value*1000000;
    } else if (unit == "oz") {
        return value*28349.5;
    } else if (unit == "lb") {
        return value*453592;
    }
}

function MgToWeight(value, unit, display) {
    if (typeof display == "undefined") display = false;
    if (unit == "g") {
        return Math.round(100*value/1000.0)/100;
    } else if (unit == "kg") {
        return  Math.round(100*value/1000000.0,2)/100;
    } else if (unit == "oz") {
        return Math.round(100*value/28349.5,2)/100;
    } else if (unit == "lb") {
        if (display) {
            var out = "";
            var poundsFloat = value/453592.0
            var pounds = Math.floor(poundsFloat);
            var oz = Math.round((poundsFloat%1)*16*100)/100
            if (pounds) {

                out += "lb"
                if (pounds > 1) out += "s"
            }
        } else {
            return Math.round(100*value/453592.0,2)/100;
        }
    }
}

function renderUnitSelect(unit, unitSelectTemplate, weight) {
    var temp = {unit: unit, units: [{unit: "oz", selected: (unit=="oz")}, {unit: "lb", selected: (unit=="lb")}, {unit: "g", selected: (unit=="g")}, {unit: "kg", selected: (unit=="kg")}], weight: weight};
    return Mustache.render(unitSelectTemplate, temp);
}

Object.size = function(obj) {
    var size = 0, key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }
    return size;
};
