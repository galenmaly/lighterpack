import Vuex from 'vuex';
import Vue from 'vue';
import debounce from 'lodash/debounce';

const weightUtils = require('../utils/weight.js');
const dataTypes = require('../dataTypes.js');

const Item = dataTypes.Item;
const Category = dataTypes.Category;
const List = dataTypes.List;
const Library = dataTypes.Library;

const saveInterval = 5000;

Vue.use(Vuex);

const store = new Vuex.Store({
    state: {
        library: false,
        isSaving: false,
        syncToken: false,
        saveType: null,
        lastSaveData: null,
        loggedIn: false,
        directiveInstances: {},
    },
    getters: {
        activeList(state) {
            return state.library.getListById(state.library.defaultListId);
        },
    },
    mutations: {
        setSaveType(state, saveType) {
            state.saveType = saveType;
        },
        setSyncToken(state, syncToken) {
            state.syncToken = syncToken;
        },
        setLastSaveData(state, lastSaveData) {
            state.lastSaveData = lastSaveData;
        },
        setIsSaving(state, isSaving) {
            state.isSaving = isSaving;
        },
        signout(state) {
            createCookie('lp', '', -1);
            state.library = false; // duplicate logic
            state.loggedIn = false; // duplicate logic
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
                alert('An error occurred while loading your data.');
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
            state.library.getListById(state.library.defaultListId).calculateTotals();
        },
        setTotalUnit(state, unit) {
            state.library.totalUnit = unit;
        },
        toggleOptionalField(state, optionalField) {
            state.library.optionalFields[optionalField] = !state.library.optionalFields[optionalField];
            state.library.getListById(state.library.defaultListId).calculateTotals();
        },
        updateCurrencySymbol(state, currencySymbol) {
            state.library.currencySymbol = currencySymbol;
        },
        newItem(state, { category, _isNew }) {
            state.library.newItem({ category, _isNew });
            state.library.getListById(state.library.defaultListId).calculateTotals();
        },
        newCategory(state, list) {
            const category = state.library.newCategory({ list, _isNew: true });
            const item = state.library.newItem({ category });
            state.library.getListById(state.library.defaultListId).calculateTotals();
        },
        newList(state) {
            const list = state.library.newList();
            const category = state.library.newCategory({ list });
            const item = state.library.newItem({ category });
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
            const list = state.library.getListById(args.list.id);
            list.categoryIds = arrayMove(list.categoryIds, args.before, args.after);
            state.library.getListById(state.library.defaultListId).calculateTotals();
        },
        reorderItem(state, args) {
            const item = state.library.getItemById(args.itemId);
            const dropCategory = state.library.getCategoryById(args.categoryId);
            const list = state.library.getListById(args.list.id);
            const originalCategory = state.library.findCategoryWithItemById(item.id, list.id);
            const oldCategoryItem = originalCategory.getCategoryItemById(item.id);
            const oldIndex = originalCategory.categoryItems.indexOf(oldCategoryItem);

            if (originalCategory === dropCategory) {
                dropCategory.categoryItems = arrayMove(dropCategory.categoryItems, oldIndex, args.dropIndex);
            } else {
                originalCategory.categoryItems.splice(oldIndex, 1);
                dropCategory.categoryItems.splice(args.dropIndex, 0, oldCategoryItem);
            }
            state.library.getListById(state.library.defaultListId).calculateTotals();
        },
        addItemToCategory(state, args) {
            const item = state.library.getItemById(args.itemId);
            const dropCategory = state.library.getCategoryById(args.categoryId);

            if (item && dropCategory) {
                dropCategory.addItem({ itemId: item.id });
                const categoryItem = dropCategory.getCategoryItemById(item.id);
                const categoryItemIndex = dropCategory.categoryItems.indexOf(categoryItem);
                if (categoryItem && categoryItemIndex !== -1) {
                    dropCategory.categoryItems = arrayMove(dropCategory.categoryItems, categoryItemIndex, args.dropIndex);
                }
                state.library.getListById(state.library.defaultListId).calculateTotals();
            }
        },
        updateListName(state, updatedList) {
            const list = state.library.getListById(updatedList.id);
            list.name = updatedList.name;
        },
        updateListDescription(state, updatedList) {
            const list = state.library.getListById(updatedList.id);
            list.description = updatedList.description;
        },
        setExternalId(state, args) {
            const list = state.library.getListById(args.list.id);
            list.externalId = args.externalId;
        },
        updateCategoryName(state, updatedCategory) {
            const category = state.library.getCategoryById(updatedCategory.id);
            category.name = updatedCategory.name;
            state.library.getListById(state.library.defaultListId).calculateTotals();
        },
        updateCategoryColor(state, updatedCategory) {
            const category = state.library.getCategoryById(updatedCategory.id);
            category.color = updatedCategory.color;
        },
        updateItem(state, item) {
            state.library.updateItem(item);
            state.library.getListById(state.library.defaultListId).calculateTotals();
        },
        updateItemLink(state, args) {
            const item = state.library.getItemById(args.item.id);
            item.url = args.url;
        },
        updateItemImageUrl(state, args) {
            const item = state.library.getItemById(args.item.id);
            item.imageUrl = args.imageUrl;
            state.library.optionalFields.images = true;
            bus.$emit('optionalFieldChanged');
        },
        updateItemImage(state, args) {
            const item = state.library.getItemById(args.item.id);
            item.image = args.image;
            state.library.optionalFields.images = true;
            bus.$emit('optionalFieldChanged');
        },
        updateItemUnit(state, unit) {
            state.library.itemUnit = unit;
        },
        removeItemImage(state, updateItem) {
            const item = state.library.getItemById(updateItem.id);
            item.image = '';
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
            const copiedList = state.library.copyList(listId);
            state.library.defaultListId = copiedList.id;
        },
        importCSV(state, importData) {
            const list = state.library.newList({});
            let category;
            const newCategories = {};
            let item;
            let categoryItem;
            let row;
            let i;

            list.name = importData.name;

            for (i in importData.data) {
                row = importData.data[i];
                if (newCategories[row.category]) {
                    category = newCategories[row.category];
                } else {
                    category = state.library.newCategory({ list });
                    newCategories[row.category] = category;
                }

                item = state.library.newItem({ category, _isNew: false });
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
        },
        save() {
            // no-op
        },
        addDirectiveInstance(state, { key, value }) {
            state.directiveInstances[key] = value;
        },
        removeDirectiveInstance(state, key) {
            delete state.directiveInstances[key];
        }
    },
    actions: {
        init(context) {
            if (readCookie('lp')) {
                return context.dispatch('loadRemote');
            } if (localStorage.library) {
                return context.dispatch('loadLocal');
            }
            return new Promise((resolve, reject) => {
                context.commit('setLoggedIn', false);
                context.commit('clearLibraryData');
                resolve();
            });
        },
        loadLocal(context) {
            const libraryData = localStorage.library;
            context.commit('loadLibraryData', libraryData);
            context.commit('setSaveType', 'local');
            context.commit('setLoggedIn', false);
        },
        loadRemote(context) {
            return fetchJson('/signin', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'same-origin',
            })
                .then((response) => {
                    context.commit('setSyncToken', response.syncToken);
                    context.commit('loadLibraryData', response.library);
                    context.commit('setSaveType', 'remote');
                    context.commit('setLoggedIn', response.username);
                })
                .catch((response) => {
                    if (response.status == 401) {
                        bus.$emit('unauthorized');
                    } else {
                        return new Promise((resolve, reject) => {
                            reject('An error occurred while fetching your data, please try again later.');
                        });
                    }
                });
        },
    },
    plugins: [
        function save(store) {
            store.subscribe(debounce((mutation, state) => {
                const ignore = [
                    'setIsSaving',
                    'setSaveType',
                    'setSyncToken',
                    'setLastSaveData',
                    'signout',
                    'setLoggedIn',
                    'loadLibraryData',
                    'clearLibraryData',
                ];
                if (!state.library || ignore.indexOf(mutation.type) > -1) {
                    return;
                }
                const saveData = JSON.stringify(state.library.save());

                if (saveData == state.lastSaveData) {
                    return;
                }

                const saveRemotely = function(saveData) {
                    if (state.isSaving) {
                        setTimeout(() => { store.commit('save', true); }, saveInterval + 1);
                        return;
                    }

                    if (!saveData) {
                        saveData = JSON.stringify(state.library.save());
                    }

                    store.commit('setIsSaving', true);
                    store.commit('setLastSaveData', saveData);

                    return fetchJson('/saveLibrary/', {
                        method: 'POST',
                        body: JSON.stringify({ syncToken: state.syncToken, username: state.loggedIn, data: saveData }),
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        credentials: 'same-origin',
                    })
                        .then((response) => {
                            store.commit('setSyncToken', response.syncToken);
                            store.commit('setIsSaving', false);
                        })
                        .catch((response) => {
                            store.commit('setIsSaving', false);
                            let error = 'An error occurred while attempting to save your data.';
                            if (response.json && response.json.status) {
                                error = response.json.status;
                            }
                            if (response.status == 401) {
                                bus.$emit('unauthorized', error);
                            } else {
                                alert(error); // TODO
                            }
                        });
                }

                if (state.saveType === 'remote') {
                    saveRemotely(saveData);
                } else if (state.saveType === 'local') {
                    localStorage.library = saveData;
                }
            }, saveInterval, { maxWait: saveInterval * 3 }));
        },
    ],
});

export default store;
