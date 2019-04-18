import "@babel/polyfill";

import Vue from "vue";
import VueRouter from "vue-router";

const focusDirectives = require("./utils/focus.js");
const dataTypes = require("./dataTypes.js");
const Item = dataTypes.Item;
const Category = dataTypes.Category;
const List = dataTypes.List;
const Library = dataTypes.Library;

Vue.use(VueRouter);

const utils = require("./utils/utils.js");

import routes from "./routes";
import store from "./store/store";

window.Vue = Vue; //surfacing Vue globally for utils methods
window.bus = new Vue(); //global event bus
window.router = new VueRouter({
    mode: "history",
    routes: routes
});

bus.$on("unauthorized", (error) => {
    window.location = "/signin";
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