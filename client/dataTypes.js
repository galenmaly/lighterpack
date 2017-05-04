if (typeof Vue === "undefined") {
    var Vue = require("vue");
}

const colorUtils = require("./utils/color.js");
const weightUtils = require("./utils/weight.js");

const Item = function(args) {
    this.id = args.id;
    this.name = "";
    this.description = "";
    this.weight = 0;
    this.authorUnit = "oz";
    if (args.unit) this.authorUnit = args.unit;
    this.price = 0;
    this.image = "";
    this.imageUrl = "";
    this.url = "";
    return this;
}

Item.prototype.save = function() {
    return this;
}

Item.prototype.load = function(input) {
    Vue.util.extend(this, input);
}

const Category = function(args) {
    this.library = args.library;
    this.id = args.id;
    this.name = "";
    this.categoryItems = [];
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
    Vue.util.extend(temp, args);
    this.categoryItems.push(temp);
}

Category.prototype.updateCategoryItem = function (categoryItem) {
    var oldCategoryItem = this.getCategoryItemById(categoryItem.itemId);
    Vue.util.extend(oldCategoryItem, categoryItem);
}   

Category.prototype.removeItem = function (itemId) {
    var categoryItem = this.getCategoryItemById(itemId);
    var index = this.categoryItems.indexOf(categoryItem);
    this.categoryItems.splice(index,1);
}

Category.prototype.calculateSubtotal = function() {
    this.subtotal = 0;
    this.wornSubtotal = 0;
    this.consumableSubtotal = 0;
    this.qtySubtotal = 0;
    this.priceSubtotal = 0;
    for (var i in this.categoryItems) {
        var categoryItem = this.categoryItems[i];
        var item = this.library.getItemById(categoryItem.itemId);
        this.subtotal += item.weight*categoryItem.qty;
        if (this.library.optionalFields.worn && categoryItem.worn) {
            this.wornSubtotal += item.weight * ( (categoryItem.qty > 0) ? 1 : 0 );
        }
        if (this.library.optionalFields.consumable && categoryItem.consumable) {
            this.consumableSubtotal += item.weight * categoryItem.qty;
        }
        this.qtySubtotal += categoryItem.qty;
        this.priceSubtotal += item.price * categoryItem.qty;
    }
    this.displayPriceSubtotal = this.priceSubtotal.toFixed(2);
}

Category.prototype.getCategoryItemById = function(id) {
    for (var i in this.categoryItems) {
        var categoryItem = this.categoryItems[i];
        if (categoryItem.itemId == id) return categoryItem;
    }
    return null;
}

Category.prototype.getExtendedItemByIndex = function(index) {
    var categoryItem = this.categoryItems[index];
    var item = this.library.getItemById(categoryItem.itemId);
    Vue.util.extend(item, categoryItem);
    return item;
}

Category.prototype.save = function() {
    var out = Vue.util.extend({}, this);
    delete out.library;
    delete out.template;
    return out;
}

Category.prototype.load = function(input) {
    Vue.util.extend(this, input);

    if (typeof this.itemIds !== "undefined") {
        if (this.categoryItems.length === 0) {
            this.categoryItems = this.itemIds;
            delete this.itemIds;
        } else {
            delete this.itemIds;
        }
    }

    for (var i = 0; i < this.categoryItems.length; i++) {
        if (typeof this.categoryItems[i].price !== "undefined") {
            delete this.categoryItems[i].price;
        }
        if (!this.categoryItems[i].star) {
            this.categoryItems[i].star = 0;
        }
    }
}

const List = function(args) {
    this.library = args.library;
    this.id = args.id;
    this.name = "";
    this.categoryIds = [];
    this.chart = null;
    this.description = "";
    this.externalId = "";
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
    
    var getTooltipText = function(name, valueMg, unit) {
      return name + ": " + weightUtils.MgToWeight(valueMg, unit) + " " + unit;
    };
    
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

            var tempColor = category.color || colorUtils.getColor(i);
            category.displayColor = colorUtils.rgbToString(tempColor);
            var tempCategory = {};

            for (var j in category.categoryItems) {
                var item = category.getExtendedItemByIndex(j);
                var value = item.weight * item.qty;
                if (!value) value = 0;
                var name = getTooltipText(item.name, value, item.authorUnit);
                var color = colorUtils.getColor(j, tempColor);
                if (item.qty > 1) name += " x "+item.qty;
                var percent = value / categoryTotal;
                var tempItem =  { value: value, id: item.id, name: name, color: color, percent: percent };
                if (linkParent) tempItem.parent = tempCategory;
                points[j] = tempItem;
            }
            var percent = categoryTotal / total;
            var tempCategoryData = {points: points, color: category.color, id:category.id, name: getTooltipText(category.name, categoryTotal, this.library.totalUnit), total: categoryTotal, percent: percent, visiblePoints: false};
            if (linkParent) tempCategoryData.parent = chartData;
            Vue.util.extend(tempCategory, tempCategoryData);
            chartData.points[i] = tempCategory;
        }
    }
    chartData.total = total;

    return chartData;
}

List.prototype.calculateTotals = function() {
    var total = 0,
        wornTotal = 0,
        consumableTotal = 0,
        packTotal = 0,
        qtyTotal = 0,
        out = {categories: []};

    for (var i in this.categoryIds) {
        var category = this.library.getCategoryById(this.categoryIds[i]);
        category.calculateSubtotal();

        total += category.subtotal;
        wornTotal += category.wornSubtotal;
        consumableTotal += category.consumableSubtotal;
        qtyTotal += category.qtySubtotal;
        out.categories.push(category);
    }

    packTotal = total - (wornTotal + consumableTotal);

    this.total = total;
    this.packTotal = packTotal;
    this.qtyTotal = qtyTotal;
    this.wornTotal = wornTotal;
    this.consumableTotal = consumableTotal;
}

List.prototype.save = function() {
    var out = Vue.util.extend({}, this);
    delete out.library;
    delete out.chart;
    return out;
}

List.prototype.load = function(input) {
    Vue.util.extend(this, input);
    this.calculateTotals();
}

const Library = function(args) {
    this.version = "0.3";
    this.idMap = {};
    this.items = [];
    this.categories = [];
    this.lists = [];
    this.sequence = 0;
    this.defaultListId = 1;
    this.totalUnit = "oz";
    this.itemUnit = "oz";
    this.showSidebar = true;
    this.showImages = false;
    this.optionalFields = {
            images: false,
            price: false,
            worn: true,
            consumable: true,
            listDescription: false
        };
    this.currencySymbol = "$";
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
    this.items.push(temp);
    this.idMap[temp.id] = temp;
    if (args.category) args.category.addItem({itemId: temp.id});
    return temp;
}

Library.prototype.updateItem = function(item) {
    var oldItem = this.getItemById(item.id);
    Vue.util.extend(oldItem, item);
    return oldItem;
}

Library.prototype.removeItem = function(id) {
    var item = this.getItemById(id);
    for (var i in this.lists) {
        var category = this.findCategoryWithItemById(id, this.lists[i].id);
        if (category) {
            category.removeItem(id);
        }
    }

    this.items.splice(this.items.indexOf(item), 1);
    delete this.idMap[id];

    return true;
}

Library.prototype.newCategory = function(args) {
    var temp = new Category({id: this.nextSequence(), library: this});
    this.categories.push(temp);
    this.idMap[temp.id] = temp;
    if (args.list) args.list.addCategory(temp.id);
    return temp;
}

Library.prototype.removeCategory = function(id, force) {
    var category = this.getCategoryById(id);
    var list = this.findListWithCategoryById(id);

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
}

Library.prototype.newList = function() {
    var temp = new List({id: this.nextSequence(), library: this});
    this.lists.push(temp);
    this.idMap[temp.id] = temp;
    if (!this.defaultListId) this.defaultListId = temp.id;
    return temp;
}

Library.prototype.removeList = function(id) {
    if (Object.size(this.lists) == 1) return;
    var list = this.getListById(id);

    for (var i = 0; i < list.categoryIds; i++) {
        this.removeCategory(list.categoryIds[i], true);
    }

    this.lists.splice(this.lists.indexOf(list), 1);
    delete this.idMap[id];

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

    var copiedList = this.newList();

    copiedList.name = "Copy of " + oldList.name;
    for (var i in oldList.categoryIds) {
        var oldCategory = this.getCategoryById(oldList.categoryIds[i]),
            copiedCategory = this.newCategory({list: copiedList});

        copiedCategory.name = oldCategory.name;

        for (var j in oldCategory.categoryItems) {
            copiedCategory.addItem(oldCategory.categoryItems[j]);
        }
    }

    return copiedList;
}

Library.prototype.renderChart = function(type) {
    return this.getListById(this.defaultListId).renderChart(type);
}

Library.prototype.getCategoryById = function(id) {
    return this.idMap[id];
}

Library.prototype.getItemById = function(id) {
    return this.idMap[id];
}

Library.prototype.getListById = function(id) {
    return this.idMap[id];
}

Library.prototype.getItemsInCurrentList = function() {
    var out = [];
    var list = this.getListById(this.defaultListId);
    for (var i = 0; i < list.categoryIds.length; i++) {
        var category = this.getCategoryById(list.categoryIds[i]);
        if (category) {
            for (var j in category.categoryItems) {
                var categoryItem = category.categoryItems[j];
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
                for (var j in category.categoryItems) {
                    var categoryItem = category.categoryItems[j];
                    if (categoryItem.itemId == itemId) return category;
                }
            }
        }
    } else {
        for (var i in this.categories) {
            var category = this.categories[i];
            if (category) {
                for (var j in category.categoryItems) {
                    var categoryItem = category.categoryItems[j];
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
    out.currencySymbol = this.currencySymbol;

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

    Vue.util.extend(this.optionalFields, input.optionalFields);

    for (var i in input.items) {
        var temp = new Item({id: input.items[i].id, library: this});
        temp.load(input.items[i]);
        this.items.push(temp);
        this.idMap[temp.id] = temp;
    }

    this.categories = [];
    for (var i in input.categories) {
        var temp = new Category({id: input.categories[i].id, library: this});
        temp.load(input.categories[i]);
        this.categories.push(temp);
        this.idMap[temp.id] = temp;
    }

    this.lists = [];
    for (var i in input.lists) {
        var temp = new List({id: input.lists[i].id, library: this});
        temp.load(input.lists[i]);
        this.lists.push(temp);
        this.idMap[temp.id] = temp;
    }

    if (input.showSidebar) this.showSidebar = input.showSidebar;
    if (input.totalUnit) this.totalUnit = input.totalUnit;
    if (input.itemUnit) this.itemUnit = input.itemUnit;
    if (input.currencySymbol) this.currencySymbol = input.currencySymbol;
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
    this.version == "0.2";
}

Object.size = function(obj) {
    var size = 0, key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }
    return size;
};

module.exports = {
    Library,
    List,
    Category,
    Item
};