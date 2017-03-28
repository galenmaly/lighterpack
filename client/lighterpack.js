const Vue = require("vue");
const Vuex = require('vuex').default;
const VueRouter = require("vue-router").default;

const dataTypes = require("./dataTypes.js");
const Item = dataTypes.Item;
const Category = dataTypes.Category;
const List = dataTypes.List;
const Library = dataTypes.Library;

Vue.use(VueRouter);

const utils = require("./utils/utils.js");
const routes = require("./routes.js");
const store = require("./store/index.js");

window.Vue = Vue; //surfacing Vue globally for utils methods
window.bus = new Vue(); //global event bus
window.router = new VueRouter({
    mode: "history",
    routes: routes
});

store.dispatch('init').then(() => {
    if (!store.state.library) {
        router.push("/welcome");
    }
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
});
