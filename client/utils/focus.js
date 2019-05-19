import Vue from 'vue';
import uniqueId from 'lodash/uniqueId';

import store from '../store/store.js';

Vue.directive('select-on-focus', {
    inserted(el) {
        el.addEventListener('focus', (evt) => {
            el.select();
        });
    },
});

Vue.directive('focus-on-create', {
    inserted(el, binding) {
        if (binding.expression && binding.value || !binding.expression) {
            el.focus();
        }
    },
});

Vue.directive('focus-on-bus', {
    inserted(el, binding) {
        bus.$on(binding.value, () => {
            el.focus();
        });
    },
});

Vue.directive('select-on-bus', {
    inserted(el, binding) {
        bus.$on(binding.value, () => {
            el.select();
        });
    },
});

Vue.directive('empty-if-zero', {
    inserted(el) {
        el.addEventListener('focus', (evt) => {
            if (el.value === '0' || el.value === '0.00') {
                el.dataset.originalValue = el.value;
                el.value = '';
            }
        });

        el.addEventListener('blur', (evt) => {
            if (el.value === '') {
                el.value = el.dataset.originalValue || '0';
            }
        });
    },
});

Vue.directive('click-outside', {
    inserted(el, binding) {
        const handler = (evt) => {
            if (el.contains(evt.target)) {
                return;
            }
            if (binding && typeof binding.value === "function") {
                binding.value();
            }
        };

        window.addEventListener("click", handler);

        // Store handler to clean up later
        el.dataset.clickoutside = uniqueId();
        store.commit("addDirectiveInstance", { key: el.dataset.clickoutside, value: handler });
    },
    unbind(el) {
        // clean up event handlers
        const handler = store.state.directiveInstances[el.dataset.clickoutside];
        store.commit("removeDirectiveInstance", el.dataset.clickoutside);
        window.removeEventListener("click", handler);
    }
});