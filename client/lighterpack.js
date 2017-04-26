const Promise = require('promise-polyfill');
if (!window.Promise) {
    window.Promise = Promise;
}

const Vue = require("vue");
const Vuex = require("vuex");
var VueRouter = require("vue-router");
if (VueRouter.default) {
    VueRouter = VueRouter.default;
}

const focusDirectives = require("./utils/focus.js");
const dataTypes = require("./dataTypes.js");
const Item = dataTypes.Item;
const Category = dataTypes.Category;
const List = dataTypes.List;
const Library = dataTypes.Library;

Vue.use(VueRouter);

const utils = require("./utils/utils.js");
const routes = require("./routes.js");
const store = require("./store/store.js");

window.Vue = Vue; //surfacing Vue globally for utils methods
window.bus = new Vue(); //global event bus
window.router = new VueRouter({
    mode: "history",
    routes: routes
});

bus.$on("unauthorized", (error) => {
    router.push("/signin"); //todo: route error message
});

store.dispatch('init')
.then(() => {
    initLighterPack();
})
.catch((error) => {
    if (!store.state.library) {
        router.push("/welcome");
    }
    initLighterPack();
});

var initLighterPack = function() {
    window.LighterPack = new Vue({
        router,
        store,
        data: {
            path: "",
            fatal: ""
        },
        watch: {
            $route: function(to, from) {
                this.path = to.path;
            }
        },
        mounted: function() {
            this.path = router.currentRoute.path;
        }
    }).$mount("#lp");
}