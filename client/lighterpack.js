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

// The serialized library as it was last persisted. Remote mode tracks every
// successful save; local mode writes to localStorage lazily, on the first
// edit, so until that happens the load-time snapshot is the only baseline
// there is — without it an untouched library reads as unsaved.
function lastPersistedData({ saveType, lastSaveData }) {
    if (saveType === 'remote') return lastSaveData;
    return localStorage.library || lastSaveData;
}

function hasUnsavedChanges(state) {
    return JSON.stringify(state.library.save()) !== lastPersistedData(state);
}

window.addEventListener('beforeunload', (e) => {
    const { library, saveType, isSaving } = store.state;
    if (!library || !saveType) return;
    if (isSaving || hasUnsavedChanges(store.state)) {
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
