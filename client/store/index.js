const Vue = require("vue");
const Vuex = require('vuex').default;

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
            list.calculateTotals();
            state.library.defaultListId = list.id;
        },
        updateItem(state, item) {
            //state.library.getItemById(item.id);
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
