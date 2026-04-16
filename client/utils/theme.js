const STORAGE_KEY = 'lpTheme';

function getTheme() {
    return localStorage.getItem(STORAGE_KEY)
        || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
}

/**
 * Call once before app mount. Applies the correct theme immediately (no FOUC)
 * and wires up a listener for OS-level changes when no manual preference is stored.
 */
function initTheme() {
    applyTheme(getTheme());

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem(STORAGE_KEY)) {
            applyTheme(e.matches ? 'dark' : 'light');
        }
    });
}

/** Toggle between light and dark, persist the choice, and return the new theme. */
function toggleTheme() {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
    return next;
}

export { initTheme, toggleTheme };
