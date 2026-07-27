// Press-and-hold reordering for touch (#11e).
//
// The desktop's dragula path doesn't survive the phone layout: there's no
// gutter to put a grab handle in (see the $mobile block in category.vue), and
// dragula has no autoscroll, so a row could never be dragged past the fold.
// Hence a separate gesture rather than a shim over the pointer one.
//
// Three deliberate differences from dragula: the row itself is translated
// rather than mirrored, so the gap it leaves is the drop preview; a drag only
// begins after HOLD_MS of stillness, since the whole row is already a tap
// target; and it's built on touch events, not pointer events, which would need
// touch-action: none up front and kill list scrolling.
//
// The DOM is put back as Vue rendered it before the store is told anything —
// dragula's cancel(true) contract. Vue owns these nodes.

// Stillness before a hold becomes a drag: long enough not to fire on a
// flick-scroll, short enough not to feel broken.
const HOLD_MS = 350;

// Drift that reclassifies a hold as a scroll. Generous — a resting thumb moves.
const MOVE_CANCEL_PX = 10;

// The edge zone that starts autoscrolling, and its speed at full deflection.
const EDGE_PX = 72;
const MAX_SCROLL_PX_PER_FRAME = 14;

// Index within `rows` to insert before, or rows.length when the pointer is past
// the last one. `rows` must be in document order and exclude the dragged row.
// Pure so the midpoint rule is unit testable — it's the likeliest thing here to
// be quietly wrong.
export function insertionIndexFor(rows, pointerY) {
    for (let i = 0; i < rows.length; i++) {
        const { top, height } = rows[i];
        if (pointerY < top + (height / 2)) {
            return i;
        }
    }
    return rows.length;
}

// Pixels to scroll this frame, ramping to full speed at the viewport edge. Pure
// and tested too: a flipped sign is an easy mistake and an obvious bug.
export function autoscrollDelta(pointerY, viewportHeight) {
    if (pointerY < EDGE_PX) {
        const depth = Math.min(1, (EDGE_PX - pointerY) / EDGE_PX);
        return -MAX_SCROLL_PX_PER_FRAME * depth;
    }
    const fromBottom = viewportHeight - pointerY;
    if (fromBottom < EDGE_PX) {
        const depth = Math.min(1, (EDGE_PX - fromBottom) / EDGE_PX);
        return MAX_SCROLL_PX_PER_FRAME * depth;
    }
    return 0;
}

/**
 * Wire press-and-hold reordering onto a set of containers.
 *
 * Delegated from the document, so a 300-row list costs four listeners and
 * re-rendered rows need no re-binding.
 *
 * @param {object}   options
 * @param {Function} options.containers   () => HTMLElement[], read at gesture time
 * @param {string}   options.itemSelector  rows that can be dragged
 * @param {string}   options.endSelector   child marking the end of the drop zone
 *                                         (rows land before it, never after)
 * @param {string}   [options.ignoreSelector] touches starting here never drag
 * @param {Function} [options.canStart]   ($el) => boolean, vetoes a specific row
 * @param {string}   [options.liftedClass] class on the row while it is lifted
 * @param {Function} options.onDrop       ({ el, fromContainer, toContainer }),
 *                                        called while the row still sits at its
 *                                        new position so the caller can read the
 *                                        drop index straight off the DOM
 * @returns {{ destroy: Function }}
 */
export function createTouchReorder({
    containers,
    itemSelector,
    endSelector,
    ignoreSelector,
    canStart,
    liftedClass = 'lpTouchLifted',
    onDrop,
}) {
    // Finger down, clock running, nothing lifted yet; the page still scrolls.
    let pending = null;
    let holdTimer = null;
    // A live drag. Mutually exclusive with `pending`.
    let drag = null;
    // Outlives the drag, so destroy() has to be able to reach it.
    let lateSelectionTimer = null;

    function onTouchStart(evt) {
        if (pending || drag || evt.touches.length !== 1) {
            return;
        }
        const target = evt.target;
        if (!target || !target.closest) {
            return;
        }
        if (ignoreSelector && target.closest(ignoreSelector)) {
            return;
        }
        const el = target.closest(itemSelector);
        if (!el || (canStart && !canStart(el))) {
            return;
        }
        // A row inside something we weren't asked to manage isn't ours to move.
        if (containers().indexOf(el.parentElement) === -1) {
            return;
        }

        const touch = evt.touches[0];
        pending = { el, startX: touch.clientX, startY: touch.clientY };
        holdTimer = window.setTimeout(beginDrag, HOLD_MS);
    }

    function beginDrag() {
        holdTimer = null;
        const { el, startY } = pending;
        pending = null;

        drag = {
            el,
            origParent: el.parentElement,
            // By nextSibling, not index: survives the row moving in between.
            origNext: el.nextElementSibling,
            // Where in the row the finger landed, so it rides under the touch
            // instead of snapping its top edge to it.
            grabOffsetY: startY - el.getBoundingClientRect().top,
            // Tracked rather than re-read, so repositioning costs one rect read
            // a frame instead of a clear-measure-set round trip.
            applied: 0,
            pointerY: startY,
            frame: 0,
        };

        el.classList.add(liftedClass);
        document.body.classList.add('lpTouchReordering');
        // Android only; iOS ignores it. A hold that arms silently feels broken.
        if (navigator.vibrate) {
            navigator.vibrate(8);
        }
        drag.frame = window.requestAnimationFrame(tick);
    }

    function onTouchMove(evt) {
        if (pending) {
            const touch = evt.touches[0];
            const drifted = Math.abs(touch.clientY - pending.startY) > MOVE_CANCEL_PX
                || Math.abs(touch.clientX - pending.startX) > MOVE_CANCEL_PX;
            if (drifted) {
                clearPending(); // a scroll, not a hold
            }
            return;
        }
        if (!drag) {
            return;
        }
        // Why this listener is non-passive: from here the page belongs to the
        // drag, not the scroller.
        evt.preventDefault();
        drag.pointerY = evt.touches[0].clientY;
    }

    // Backstop to the shield in item-mobile.vue. That keeps the finger off the
    // row's text, but iOS still gets its long-press interaction going now and
    // then, and -webkit-user-select doesn't reliably stop it. (Android needs
    // none of this.) Per frame rather than once at the lift, because WebKit
    // raises the selection on its own schedule; guarded because there's nothing
    // selected on nearly every frame.
    function clearSelection() {
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed) {
            selection.removeAllRanges();
        }
    }

    // Frame-driven rather than move-driven: autoscrolling moves content under a
    // finger that is perfectly still, and the row would lag behind its own drop
    // target until the next twitch.
    function tick() {
        if (!drag) {
            return;
        }
        clearSelection();
        const delta = autoscrollDelta(drag.pointerY, window.innerHeight);
        if (delta) {
            window.scrollBy(0, delta);
        }
        reposition();
        updateDropSlot();
        drag.frame = window.requestAnimationFrame(tick);
    }

    function reposition() {
        const rect = drag.el.getBoundingClientRect();
        const naturalTop = rect.top - drag.applied;
        const desiredTop = drag.pointerY - drag.grabOffsetY;
        drag.applied = desiredTop - naturalTop;
        drag.el.style.transform = `translateY(${drag.applied}px)`;
    }

    function containerAt(pointerY) {
        const candidates = containers();
        for (let i = 0; i < candidates.length; i++) {
            const rect = candidates[i].getBoundingClientRect();
            if (pointerY >= rect.top && pointerY <= rect.bottom) {
                return candidates[i];
            }
        }
        return null; // in the gap between two categories — keep the current one
    }

    function updateDropSlot() {
        const container = containerAt(drag.pointerY) || drag.el.parentElement;
        const rows = Array.prototype.filter.call(
            container.children,
            child => child !== drag.el && child.matches(itemSelector),
        );
        const index = insertionIndexFor(
            rows.map((row) => {
                const rect = row.getBoundingClientRect();
                return { top: rect.top, height: rect.height };
            }),
            drag.pointerY,
        );
        // Past the last row means before the "add new item" footer, not after.
        const before = index < rows.length ? rows[index] : container.querySelector(endSelector);

        if (drag.el.parentElement === container && drag.el.nextElementSibling === before) {
            return; // already there; reinserting churns layout every frame
        }
        container.insertBefore(drag.el, before);
    }

    function finishDrag() {
        window.cancelAnimationFrame(drag.frame);
        const { el, origParent, origNext } = drag;
        const toContainer = el.parentElement;
        const moved = !(toContainer === origParent && el.nextElementSibling === origNext);

        el.style.transform = '';
        el.classList.remove(liftedClass);
        document.body.classList.remove('lpTouchReordering');
        // Again now, and for a moment after: WebKit settles its long-press
        // selection once the touch has already ended.
        clearSelection();
        clearLateSelection();
        drag = null;

        // touchend may still raise a click, which the row reads as "open the
        // editor". Swallow it.
        swallowNextClick();

        if (moved) {
            // Row still in its new slot, so the caller reads the drop index off
            // the DOM exactly as the desktop drop handler does.
            onDrop({ el, fromContainer: origParent, toContainer });
        }
        // Hand the nodes back as Vue left them; the store's re-render is what
        // actually moves the row.
        origParent.insertBefore(el, origNext);
    }

    function onTouchEnd() {
        if (pending) {
            clearPending();
            return;
        }
        if (drag) {
            finishDrag();
        }
    }

    // The system taking the gesture away (a call, an edge swipe). Put everything
    // back and commit nothing.
    function onTouchCancel() {
        if (pending) {
            clearPending();
            return;
        }
        if (!drag) {
            return;
        }
        window.cancelAnimationFrame(drag.frame);
        drag.el.style.transform = '';
        drag.el.classList.remove(liftedClass);
        document.body.classList.remove('lpTouchReordering');
        clearSelection();
        drag.origParent.insertBefore(drag.el, drag.origNext);
        drag = null;
    }

    function clearPending() {
        window.clearTimeout(holdTimer);
        holdTimer = null;
        pending = null;
    }

    // A selection landing just after the drop is still the drag's doing.
    // selectionchange rather than a sweep, so it goes on the frame it appears.
    // Restarting the window rather than stacking one: two drops inside 400ms
    // share the listener, and the earlier timeout would tear it down early.
    function clearLateSelection() {
        document.addEventListener('selectionchange', clearSelection);
        window.clearTimeout(lateSelectionTimer);
        lateSelectionTimer = window.setTimeout(stopLateSelection, 400);
    }

    // After this a selection is the user's own, so destroy() calls this too.
    function stopLateSelection() {
        window.clearTimeout(lateSelectionTimer);
        lateSelectionTimer = null;
        document.removeEventListener('selectionchange', clearSelection);
    }

    // Capture phase, ahead of the row's own handler and item-mobile.vue's
    // document dismisser. The timeout covers the common case where
    // preventDefault on touchmove already suppressed the click.
    function swallowNextClick() {
        const cleanup = () => {
            document.removeEventListener('click', swallow, true);
            window.clearTimeout(timer);
        };
        function swallow(evt) {
            evt.preventDefault();
            evt.stopPropagation();
            cleanup();
        }
        const timer = window.setTimeout(cleanup, 400);
        document.addEventListener('click', swallow, true);
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
    document.addEventListener('touchcancel', onTouchCancel);

    return {
        destroy() {
            clearPending();
            onTouchCancel();
            stopLateSelection();
            document.removeEventListener('touchstart', onTouchStart);
            document.removeEventListener('touchmove', onTouchMove);
            document.removeEventListener('touchend', onTouchEnd);
            document.removeEventListener('touchcancel', onTouchCancel);
        },
    };
}

export default createTouchReorder;
