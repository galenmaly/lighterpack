import '@babel/polyfill';

import Vue from 'vue';
import VueRouter from 'vue-router';

import routes from './routes';
import store from './store/store';

const focusDirectives = require('./utils/focus.js');
const dataTypes = require('./dataTypes.js');

const { Item } = dataTypes;
const { Category } = dataTypes;
const { List } = dataTypes;
const { Library } = dataTypes;

Vue.use(VueRouter);

const utils = require('./utils/utils.js');

window.Vue = Vue; // surfacing Vue globally for utils methods
window.bus = new Vue(); // global event bus
window.router = new VueRouter({
    mode: 'history',
    routes,
});

bus.$on('unauthorized', (error) => {
    window.location = '/signin';
});

store.dispatch('init')
    .then(() => {
        initLighterPack();
    })
    .catch((error) => {
        if (!store.state.library) {
            router.push('/welcome');
        }
        initLighterPack();
    });

var initLighterPack = function () {
    window.LighterPack = new Vue({
        router,
        store,
        data: {
            path: '',
            fatal: '',
        },
        watch: {
            $route(to, from) {
                this.path = to.path;
            },
        },
        mounted() {
            this.path = router.currentRoute.path;
        },
    }).$mount('#lp');
};
