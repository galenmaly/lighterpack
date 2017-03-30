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
        saveType: null,
        loggedIn: false
    },
    mutations: {
        setSaveType(state, saveType) {
            state.saveType = saveType;
        },
        setLoggedIn(state, loggedIn) {
            state.loggedIn = loggedIn;
        },
        loadLibraryData(state, libraryData) {
            const library = new Library();
            library.load(JSON.parse(libraryData));
            state.library = library;
        },
        setDefaultList(state, list) {
            state.library.defaultListId = list.id;
        },
        setTotalUnit(state, unit) {
            state.library.totalUnit = unit;
        },
        toggleOptionalField(state, optionalField) {
            state.library.optionalFields[optionalField] = !state.library.optionalFields[optionalField];
        },
        newItem(state, category) {
            state.library.newItem({category});
        },
        newCategory(state, list) {
            state.library.newCategory({list});
        },
        newList(state) {
            var list = state.library.newList();
            var category = state.library.newCategory({list});
            var item = state.library.newItem({category});
            list.calculateTotals();
            state.library.defaultListId = list.id;
        },
        updateListName(state, updatedList) {
            var list = state.library.getListById(updatedList.id);
            list.name = updatedList.name;
        },
        updateCategoryName(state, updatedCategory) {
            var category = state.library.getCategoryById(updatedCategory.id);
            category.name = updatedCategory.name;
        },
        updateItem(state, item) {
            state.library.updateItem(item);
            state.library.getListById(state.library.defaultListId).calculateTotals();
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
                    context.commit("setLoggedIn", false)
                    context.commit("loadLibrary", false)
                });
            }
        },
        loadLocal: function(context) {
            var libraryData = JSON.parse(localStorage.library);
            context.commit('loadLibraryData', libraryData);
            context.commit('setSaveType', "remote");
            context.commit("setLoggedIn", false)
        },
        loadRemote: function(context) {
            return fetchJson("/signin/", {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'same-origin'
            })
            .then((response) => {
                context.commit('loadLibraryData', response.library);
                context.commit('setSaveType', "remote");
                context.commit("setLoggedIn", true)
            })
            .catch((response) => {
                console.log(response)
                return new Promise((resolve, reject) => {
                    reject("Unable to fetch connections.");
                });
            });
        }
    }
});

module.exports = store;
