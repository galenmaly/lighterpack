import './css/lighterpack.scss';
import { createApp } from 'vue';
import { createRouter, createWebHistory, RouterView } from 'vue-router';

import routes from './routes';
import store from './store/store';
import { selectOnFocus, focusOnCreate, emptyIfZero, clickOutside } from './utils/focus.js';

import './utils/utils.js';

const router = createRouter({
    history: createWebHistory(),
    routes,
});

const app = createApp(RouterView);

app.use(router);
app.use(store);

app.directive('select-on-focus', selectOnFocus);
app.directive('focus-on-create', focusOnCreate);
app.directive('empty-if-zero', emptyIfZero);
app.directive('click-outside', clickOutside);

store.dispatch('init')
    .then(() => {
        app.mount('#lp');
        window.LighterPack = { $store: store };
    })
    .catch((error) => {
        if (!store.state.library) {
            router.push('/welcome');
        }
        app.mount('#lp');
        window.LighterPack = { $store: store };
    });
