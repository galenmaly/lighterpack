const Vue = require("vue");
const Vuex = require('vuex').default;

const weightUtils = require("../utils/weight.js");
const dataTypes = require("../dataTypes.js");
const Item = dataTypes.Item;
const Category = dataTypes.Category;
const List = dataTypes.List;
const Library = dataTypes.Library;

Vue.use(Vuex);

const store = new Vuex.Store({
    state: {
        library: false,
        syncToken: false,
        saveType: null,
        saveTimeout: null,
        lastSaveTime: 0,
        lastSaveData: null,
        loggedIn: false
    },
    mutations: {
        setSaveType(state, saveType) {
            state.saveType = saveType;
        },
        setSyncToken(state, syncToken) {
            state.syncToken = syncToken;
        },
        setLastSaveTime(state, lastSaveTime) {
            state.lastSaveTime = lastSaveTime;
        },
        setLastSaveData(state, lastSaveData) {
            state.lastSaveData = lastSaveData;
        },
        setSaveTimeout(state, saveTimeout) {
            state.saveTimeout = saveTimeout
        },
        clearSaveTimeout(state) {
            if (state.saveTimeout) {
                clearTimeout(state.saveTimeout);
                state.saveTimeout = null;
            }
        },
        signout(state) {
            createCookie("lp","",-1);
            state.library = false; //duplicate logic
            state.loggedIn = false; //duplicate logic
        },
        setLoggedIn(state, loggedIn) {
            state.loggedIn = loggedIn;
        },
        loadLibraryData(state, libraryData) {
            const library = new Library();
            try {
                libraryData = JSON.parse(libraryData);
                library.load(libraryData);
                state.library = library;
            } catch (err) {
                alert("An error occurred while loading your data.");
            }
            state.lastSaveData = JSON.stringify(library.save());
        },
        clearLibraryData(state) {
            state.library = false;
        },
        toggleSidebar(state) {
            state.library.showSidebar = !state.library.showSidebar;
        },
        setDefaultList(state, list) {
            state.library.defaultListId = list.id;
        },
        setTotalUnit(state, unit) {
            state.library.totalUnit = unit;
        },
        toggleOptionalField(state, optionalField) {
            state.library.optionalFields[optionalField] = !state.library.optionalFields[optionalField];
            state.library.getListById(state.library.defaultListId).calculateTotals();
        },
        updateCurrencySymbol(state, currencySymbol) {
            state.library.currencySymbol = currencySymbol
        },
        newItem(state, category) {
            state.library.newItem({category});
            state.library.getListById(state.library.defaultListId).calculateTotals();
        },
        newCategory(state, list) {
            var category = state.library.newCategory({list});
            var item = state.library.newItem({category});
            state.library.getListById(state.library.defaultListId).calculateTotals();
        },
        newList(state) {
            var list = state.library.newList();
            var category = state.library.newCategory({list});
            var item = state.library.newItem({category});
            list.calculateTotals();
            state.library.defaultListId = list.id;
        },
        removeItem(state, item) {
            state.library.removeItem(item.id);
        },
        removeCategory(state, category) {
            state.library.removeCategory(category.id);
        },
        removeList(state, list) {
            state.library.removeList(list.id);
        },
        reorderList(state, args) {
            state.library.lists = arrayMove(state.library.lists, args.before, args.after);
        },
        reorderCategory(state, args) {
            var list = state.library.getListById(args.list.id);
            list.categoryIds = arrayMove(list.categoryIds, args.before, args.after);
            state.library.getListById(state.library.defaultListId).calculateTotals();
        },
        reorderItem(state, args) {
            var item = state.library.getItemById(args.itemId);
            var dropCategory = state.library.getCategoryById(args.categoryId);
            var list = state.library.getListById(args.list.id);
            var originalCategory = state.library.findCategoryWithItemById(item.id, list.id);
            var oldCategoryItem = originalCategory.getCategoryItemById(item.id);
            var oldIndex = originalCategory.categoryItems.indexOf(oldCategoryItem);

            if (originalCategory === dropCategory) {
                dropCategory.categoryItems = arrayMove(dropCategory.categoryItems, oldIndex, args.dropIndex);
            } else {
                originalCategory.categoryItems.splice(oldIndex, 1);
                dropCategory.categoryItems.splice(args.dropIndex, 0, oldCategoryItem);
            }
            state.library.getListById(state.library.defaultListId).calculateTotals();
        },
        addItemToCategory(state, args) {
            var item = state.library.getItemById(args.itemId);
            var dropCategory = state.library.getCategoryById(args.categoryId);

            if (item && dropCategory) {
                dropCategory.addItem(item);
                var categoryItem = dropCategory.getCategoryItemById(item.id);
                var categoryItemIndex = dropCategory.categoryItems.indexOf(categoryItem);
                if (categoryItem && categoryItemIndex !== -1) {
                    dropCategory.categoryItems = arrayMove(dropCategory.categoryItems, categoryItemIndex, args.dropIndex);
                }
                state.library.getListById(state.library.defaultListId).calculateTotals();
            }
        },
        updateListName(state, updatedList) {
            var list = state.library.getListById(updatedList.id);
            list.name = updatedList.name;
        },
        updateListDescription(state, updatedList) {
            var list = state.library.getListById(updatedList.id);
            list.description = updatedList.description;
        },
        setExternalId(state, args) {
            var list = state.library.getListById(args.list.id);
            list.externalId = args.externalId;
        },
        updateCategoryName(state, updatedCategory) {
            var category = state.library.getCategoryById(updatedCategory.id);
            category.name = updatedCategory.name;
            state.library.getListById(state.library.defaultListId).calculateTotals();
        },
        updateCategoryColor(state, updatedCategory) {
            var category = state.library.getCategoryById(updatedCategory.id);
            category.color = updatedCategory.color;
        },
        updateItem(state, item) {
            state.library.updateItem(item);
            state.library.getListById(state.library.defaultListId).calculateTotals();
        },
        updateItemLink(state, args) {
            var item = state.library.getItemById(args.item.id);
            item.url = args.url;
        },
        updateItemImageUrl(state, args) {
            var item = state.library.getItemById(args.item.id);
            item.imageUrl = args.imageUrl;
            state.library.optionalFields["images"] = true;
        },
        updateItemImage(state, args) {
            var item = state.library.getItemById(args.item.id);
            item.image = args.image;
            state.library.optionalFields["images"] = true;
        },
        removeItemImage(state, updateItem) {
            var item = state.library.getItemById(updateItem.id);
            item.image = "";
        },
        updateCategoryItem(state, args) {
            args.category.updateCategoryItem(args.categoryItem);
            state.library.getListById(state.library.defaultListId).calculateTotals();
        },
        removeItemFromCategory(state, args) {
            args.category.removeItem(args.itemId);
            state.library.getListById(state.library.defaultListId).calculateTotals();
        },
        copyList(state, listId) {
            var copiedList = state.library.copyList(listId);
            state.library.defaultListId = copiedList.id;
        },
        importCSV(state, importData) {
            var list = state.library.newList({}),
                category,
                newCategories = {},
                item,
                categoryItem,
                row,
                i;

            list.name = importData.name;

            for (i in importData.data) {
                row = importData.data[i];
                if (newCategories[row.category]) {
                    category = newCategories[row.category];
                } else {
                    category = state.library.newCategory({list: list});
                    newCategories[row.category] = category;
                }

                item = state.library.newItem({category: category});
                categoryItem = category.getCategoryItemById(item.id);

                item.name = row.name;
                item.description = row.description;
                categoryItem.qty = parseFloat(row.qty);
                item.weight = weightUtils.WeightToMg(parseFloat(row.weight), row.unit);
                item.authorUnit = row.unit;
                category.name = row.category;
            }
            list.calculateTotals();
            state.library.defaultListId = list.id;
        }
    },
    actions: {
        init: function(context) {
            if (readCookie("lp")) {
                return context.dispatch("loadRemote");
            } else if (localStorage.library) {
                return context.dispatch("loadLocal");
            } else {
                return new Promise((resolve, reject) => {
                    context.commit("setLoggedIn", false);
                    context.commit("clearLibraryData");
                    resolve();
                });
            }
        },
        loadLocal: function(context) {
            var libraryData = localStorage.library;
            context.commit('loadLibraryData', libraryData);
            context.commit('setSaveType', "local");
            context.commit("setLoggedIn", false)
        },
        loadRemote: function(context) {
            return fetchJson("/signin", {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'same-origin'
            })
            .then((response) => {
                context.commit('setSyncToken', response.syncToken);
                context.commit('loadLibraryData', response.library);
                context.commit('setSaveType', "remote");
                context.commit("setLoggedIn", response.username)
            })
            .catch((response) => {
                if (response.status == 401) {
                    bus.$emit("unauthorized");
                } else {
                   return new Promise((resolve, reject) => {
                        reject("An error occurred while fetching your data, please try again later.");
                    });
                }
            });
        }
    },
    plugins: [
        function save(store) {
            store.subscribe((mutation, state) => {
                const ignore = [
                    "setSaveType",
                    "setSyncToken",
                    "setLastSaveTime",
                    "setLastSaveData",
                    "setSaveTimeout",
                    "clearSaveTimeout",
                    "signout",
                    "setLoggedIn",
                    "loadLibraryData",
                    "clearLibraryData"
                ];
                if (!state.library || ignore.indexOf(mutation.type) > -1) {
                    return;
                }
                var saveData = JSON.stringify(state.library.save());

                if (saveData == state.lastSaveData) {
                    return;
                }

                function saveRemotely(saveData) {
                    var date = new Date();
                    if (date.getTime() - state.lastSaveTime < 5000) {
                         if (!state.saveTimeout) {
                            store.commit("setSaveTimeout", setTimeout(saveRemotely, 5001));
                        }
                        return;
                    }

                    if (state.saveTimeout) {
                        store.commit("clearSaveTimeout");
                    }

                    if (!saveData) {
                        saveData = JSON.stringify(state.library.save());
                    }
                    store.commit("setLastSaveTime", date.getTime());
                    store.commit("setLastSaveData", saveData);

                    return fetchJson("/saveLibrary/", {
                        method: "POST",
                        body:  JSON.stringify({syncToken: state.syncToken, username: state.loggedIn, data: saveData}),
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        credentials: 'same-origin',
                    })
                    .then((response) => {
                        store.commit("setSyncToken", response.syncToken);
                    })
                    .catch((response) => {
                        var error = "An error occurred while attempting to save your data.";
                        if (response.json && response.json.status) {
                            error = response.json.status;
                        }
                        if (response.status == 401) {
                            bus.$emit("unauthorized", error);
                        } else {
                            alert(error); //TODO
                        }
                    });
                }
                
                if (state.saveType === "remote") {
                    saveRemotely(saveData);
                } else if (state.saveType === "local") {
                    localStorage.library = saveData;
                }
            });
        }
    ]
});

module.exports = store;
