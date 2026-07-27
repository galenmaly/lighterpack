import './css/share.scss';
import pies from './pies.js';

function MgToWeight(value, unit) {
    if (unit === 'g') return Math.round(100 * value / 1000.0) / 100;
    if (unit === 'kg') return Math.round(100 * value / 1000000.0) / 100;
    if (unit === 'oz') return Math.round(100 * value / 28349.5) / 100;
    if (unit === 'lb') return Math.round(100 * value / 453592.0) / 100;
    return value;
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

    const chartContainer = document.querySelector('.lpChart');
    if (typeof chartData !== 'undefined' && chartContainer) {
        const parsed = JSON.parse(unescape(chartData));
        addParents(parsed, false);
        pies({ processedData: parsed, container: chartContainer, hoverCallback: chartHover });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
