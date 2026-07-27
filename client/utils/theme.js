const STORAGE_KEY = 'lpTheme';

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)');

const listeners = new Set();
let lastNotified = null;

function getTheme() {
    return localStorage.getItem(STORAGE_KEY)
        || (darkQuery().matches ? 'dark' : 'light');
}

/**
 * The theme actually in effect: an explicit override if a toggle has set one,
 * otherwise the OS preference. The attribute is absent only before initTheme()
 * runs, so the media-query fallback also covers that window — the same path
 * _base.scss uses to style the page until then.
 */
function resolvedTheme() {
    return document.documentElement.getAttribute('data-theme')
        || (darkQuery().matches ? 'dark' : 'light');
}

function notify() {
    const theme = resolvedTheme();
    // An OS-level change reaches us twice in the app: once via initTheme's own
    // listener writing the attribute, once via the listener onThemeChange adds.
    if (theme === lastNotified) return;
    lastNotified = theme;
    listeners.forEach(fn => fn(theme));
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    notify();
}

/**
 * Call once before app mount. Applies the correct theme immediately (no FOUC)
 * and wires up a listener for OS-level changes when no manual preference is stored.
 */
function initTheme() {
    applyTheme(getTheme());

    darkQuery().addEventListener('change', (e) => {
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

/**
 * Run fn(theme) whenever the effective theme changes, and return an unsubscribe.
 *
 * Subscribes to the media query itself rather than relying on applyTheme, so it
 * still fires for an OS-level change that arrives before initTheme() has run.
 * Callers that unmount MUST unsubscribe.
 */
function onThemeChange(fn) {
    if (!listeners.size) {
        lastNotified = resolvedTheme();
        darkQuery().addEventListener('change', notify);
    }
    listeners.add(fn);

    return function unsubscribe() {
        listeners.delete(fn);
        if (!listeners.size) darkQuery().removeEventListener('change', notify);
    };
}

/**
 * Reads a chart color from the palette, so the values live in _globals.scss
 * rather than being duplicated in JS. A canvas can't reference a CSS variable,
 * so callers hand these to pies() and re-hand them on a theme change.
 *
 * Returns undefined if the token isn't resolvable (stylesheet not applied yet),
 * which leaves pies.js on its own default rather than guessing a color here.
 */
function readToken(name) {
    return getComputedStyle(document.documentElement)
        .getPropertyValue(name)
        .trim() || undefined;
}

/** Stroke drawn between chart slices. */
function chartLineColor() {
    return readToken('--lp-chart-line');
}

/** Ring drawn around the slice under the cursor. */
function chartHoverColor() {
    return readToken('--lp-chart-hover-line');
}

export {
    initTheme, toggleTheme, onThemeChange, chartLineColor, chartHoverColor,
};
