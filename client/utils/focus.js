const clickOutsideHandlers = new WeakMap();

export const selectOnFocus = {
    mounted(el) {
        el.addEventListener('focus', () => {
            el.select();
        });
    },
};

export const focusOnCreate = {
    mounted(el, binding) {
        if (binding.value !== undefined ? binding.value : true) {
            el.focus();
        }
    },
};

export const emptyIfZero = {
    mounted(el) {
        el.addEventListener('focus', () => {
            if (el.value === '0' || el.value === '0.00') {
                el.dataset.originalValue = el.value;
                el.value = '';
                el._emptyIfZero = true;
            }
        });

        // Once the user types, stop forcing the field empty so their input
        // survives the re-render savePrice/saveWeight triggers.
        el.addEventListener('input', () => {
            el._emptyIfZero = false;
        });

        el.addEventListener('blur', () => {
            el._emptyIfZero = false;
            if (el.value === '') {
                el.value = el.dataset.originalValue || '0';
            }
        });
    },

    // A re-render while the field is focused — e.g. the row's focus state
    // toggling its hint bubbles — makes v-model rewrite el.value back to the
    // bound zero, undoing the empty above. Re-clear it so a freshly-focused
    // zero field stays empty until the user actually types.
    updated(el) {
        if (el._emptyIfZero && document.activeElement === el) {
            el.value = '';
        }
    },
};

export const clickOutside = {
    mounted(el, binding) {
        const handler = (evt) => {
            if (el.contains(evt.target)) return;
            if (typeof binding.value === 'function') binding.value();
        };
        clickOutsideHandlers.set(el, handler);
        window.addEventListener('click', handler);
    },
    unmounted(el) {
        const handler = clickOutsideHandlers.get(el);
        if (handler) {
            window.removeEventListener('click', handler);
            clickOutsideHandlers.delete(el);
        }
    },
};
