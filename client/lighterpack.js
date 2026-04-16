import './css/lighterpack.scss';
import { initTheme } from './utils/theme.js';
import { createApp } from 'vue';
import { createRouter, createWebHistory, RouterView } from 'vue-router';

import routes from './routes';
import store from './store/store';
import { selectOnFocus, focusOnCreate, emptyIfZero, clickOutside } from './utils/focus.js';

import './utils/utils.js';

initTheme();

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

window.addEventListener('beforeunload', (e) => {
    const { library, saveType, lastSaveData, isSaving } = store.state;
    if (!library || !saveType) return;
    if (isSaving) {
        e.preventDefault();
        return;
    }
    const currentData = JSON.stringify(library.save());
    const hasUnsavedChanges = saveType === 'remote'
        ? currentData !== lastSaveData
        : currentData !== localStorage.library;
    if (hasUnsavedChanges) {
        e.preventDefault();
    }
});

store.dispatch('init')
    .then(() => {
        app.mount('#lp');
        window.LighterPack = { $store: store };
    })
    .catch((_error) => {
        if (!store.state.library) {
            router.push('/welcome');
        }
        app.mount('#lp');
        window.LighterPack = { $store: store };
    });
