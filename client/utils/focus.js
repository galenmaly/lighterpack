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
            }
        });

        el.addEventListener('blur', () => {
            if (el.value === '') {
                el.value = el.dataset.originalValue || '0';
            }
        });
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
