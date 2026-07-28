import './css/share.scss';
import pies from './pies.js';
import weightUtils from './utils/weight.js';
import {
    initTheme, toggleTheme, chartLineColor, chartHoverColor, onThemeChange,
} from './utils/theme.js';

// Before DOM ready, matching lighterpack.js. The inline script in
// share.mustache has already applied any stored choice to avoid a flash; this
// re-applies the same value and registers the OS-change listener.
//
// Guarded because this runs at module scope on a public page: theme.js reaches
// localStorage, which throws outright when a browser has storage disabled, and
// an exception here would take the chart, unit pickers and image modal down
// with it. Losing the stored theme is survivable -- the media query in
// _base.scss still resolves a sensible one.
function safely(fn) {
    try {
        return fn();
    } catch (_e) {
        return undefined;
    }
}

safely(initTheme);

// Server-rendered numbers on this page come from MgToDisplayWeight, so the
// reader flipping a unit picker has to land on the same digits -- this defers
// to that function instead of the copy of the rounding rule that used to live
// here, which is exactly the kind of thing that drifts. The passthrough keeps
// the old behaviour for a unit it doesn't recognise; the pickers only ever
// offer oz/lb/g/kg.
function MgToWeight(value, unit) {
    const weight = weightUtils.MgToDisplayWeight(value, unit);
    return weight === undefined ? value : weight;
}

function addParents(chartData, parent) {
    if (parent) chartData.parent = parent;
    for (const i in chartData.points) {
        addParents(chartData.points[i], chartData);
    }
}

function chartHover(chartItem) {
    document.querySelectorAll('.hover').forEach(el => el.classList.remove('hover'));
    if (chartItem && chartItem.id) {
        const el = document.getElementById(`total_${chartItem.id}`);
        if (el) el.classList.add('hover');
    }
}

function updateSubtotalsUnit(unit) {
    document.querySelectorAll('.lpDisplaySubtotal').forEach((el) => {
        el.textContent = MgToWeight(parseFloat(el.getAttribute('mg')), unit);
        const next = el.nextElementSibling;
        if (next) next.textContent = unit;
    });
}

// Same switch, same lpTheme key, same precedence as the toggle in the app's
// account menu -- a reader's choice here is the one they get on the edit page,
// and vice versa. The checkbox also tracks the OS flipping underneath when no
// explicit choice is stored, which is why it re-reads rather than assuming its
// own state is authoritative.
function initThemeToggle() {
    const control = document.getElementById('lpThemeToggle');
    if (!control) return;

    const sync = () => {
        control.checked = document.documentElement.getAttribute('data-theme') === 'dark';
    };

    sync();
    control.addEventListener('change', () => {
        // toggleTheme writes to localStorage before it applies the theme, so
        // with storage disabled nothing changes and this throws. The sync()
        // below then snaps the switch back to the theme actually in effect,
        // which at least reads as a refusal rather than a silent no-op.
        safely(toggleTheme);
        sync();
    });
    onThemeChange(sync);
}

// The gear in the page header. .lpOpen is this page's existing "open" flag, so
// the document-level handler at the bottom of initEventHandlers dismisses this
// on an outside click too and it needs no handler of its own -- syncAria only
// keeps the button in step with whoever cleared the class.
function initShareMenu() {
    const menu = document.querySelector('.lpShareMenu');
    if (!menu) return;
    const target = menu.querySelector('.lpShareMenuTarget');
    const content = menu.querySelector('.lpShareMenuContent');

    const syncAria = () => {
        target.setAttribute('aria-expanded', String(menu.classList.contains('lpOpen')));
    };

    target.addEventListener('click', (evt) => {
        evt.stopPropagation();
        menu.classList.toggle('lpOpen');
        syncAria();
    });

    // Same call the app's account menu makes: the switch inside is a setting,
    // not an errand, so flipping it leaves the menu open to show it flip.
    content.addEventListener('click', evt => evt.stopPropagation());

    // Registered after the dismiss-everything handler, so the class is already
    // settled by the time this reads it.
    document.addEventListener('click', syncAria);

    document.addEventListener('keydown', (evt) => {
        if (evt.key !== 'Escape' || !menu.classList.contains('lpOpen')) return;
        menu.classList.remove('lpOpen');
        syncAria();
        target.focus();
    });
}

function initEventHandlers() {
    const list = document.querySelector('.lpList');
    const categories = document.querySelector('.lpCategories');
    const imageModal = document.getElementById('lpImageDialog');
    const modalOverlay = document.querySelector('.lpModalOverlay');

    if (list) {
        list.addEventListener('click', (evt) => {
            const unitSelectEl = evt.target.closest('.lpUnitSelect');
            if (!unitSelectEl) return;

            // Every picker is itself inside a row <li> (an item row, or the
            // totals footer), so an option has to be matched against the
            // dropdown it lives in -- a bare closest('li') walks straight past
            // the option and hits the row, whose text is the whole row.
            const option = evt.target.closest('.lpUnitDropdown li');

            // Clicking anywhere else in the picker toggles it open
            if (!option) {
                evt.stopPropagation();
                unitSelectEl.classList.toggle('lpOpen');
                const value = unitSelectEl.querySelector('.lpUnit').value;
                const ul = unitSelectEl.querySelector('ul');
                ul.classList.remove('oz', 'lb', 'g', 'kg');
                ul.classList.add(value);
                return;
            }

            // Clicking a unit option
            const unit = option.textContent.trim();
            const displayEl = unitSelectEl.querySelector('.lpDisplay');
            const unitInput = unitSelectEl.querySelector('.lpUnit');
            if (displayEl) displayEl.textContent = unit;
            if (unitInput) unitInput.value = unit;

            if (unitSelectEl.closest('.lpTotalUnit')) {
                const totalValue = unitSelectEl.closest('.lpTotal')?.querySelector('.lpTotalValue');
                const mgInput = unitSelectEl.querySelector('.lpMG');
                if (totalValue && mgInput) {
                    totalValue.textContent = MgToWeight(parseFloat(mgInput.value), unit);
                }
                updateSubtotalsUnit(unit);
            } else {
                list.querySelectorAll('.lpWeight').forEach((weightEl) => {
                    const weightCell = weightEl.parentElement;
                    const mgInput = weightCell.querySelector('.lpMG');
                    const displaySpan = weightCell.querySelector('.lpDisplay');
                    if (mgInput) weightEl.textContent = MgToWeight(parseFloat(mgInput.value), unit);
                    if (displaySpan) displaySpan.textContent = unit;
                });
            }
        });
    }

    if (categories && imageModal && modalOverlay) {
        categories.addEventListener('click', (evt) => {
            const link = evt.target.closest('.lpItemImage');
            if (!link) return;
            evt.preventDefault();
            const imageUrl = link.getAttribute('href');
            const img = document.createElement('img');
            img.src = imageUrl;
            imageModal.innerHTML = '';
            imageModal.appendChild(img);
            img.addEventListener('load', () => {
                imageModal.style.display = 'block';
                modalOverlay.style.display = 'block';
            });
        });

        modalOverlay.addEventListener('click', () => {
            if (!document.querySelector('.lpDialog:not([style*="display: none"])') ||
                !document.querySelector('.lpDialog:not([style*="display: none"])').classList.contains('sticky')) {
                modalOverlay.style.display = 'none';
                imageModal.style.display = 'none';
            }
        });
    }

    document.addEventListener('click', () => {
        document.querySelectorAll('.lpOpen').forEach(el => el.classList.remove('lpOpen'));
    });
}

function init() {
    initEventHandlers();
    initShareMenu();
    initThemeToggle();

    const chartContainer = document.querySelector('.lpChart');
    if (typeof chartData !== 'undefined' && chartContainer) {
        const parsed = JSON.parse(unescape(chartData));
        addParents(parsed, false);
        const chart = pies({
            processedData: parsed,
            container: chartContainer,
            hoverCallback: chartHover,
            lineColor: chartLineColor(),
            hoverColor: chartHoverColor(),
        });
        // Fires for both sources of a theme change here: the toggle above and
        // the OS flipping underneath. Nothing on this page unmounts, so the
        // subscription is never dropped.
        onThemeChange(() => {
            chart.update({ lineColor: chartLineColor(), hoverColor: chartHoverColor() });
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
