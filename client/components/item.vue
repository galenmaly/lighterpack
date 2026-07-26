<template>
    <li :id="item.id" :class="'lpItem '+ item.classes" data-testid="item-row" @focusin="onRowFocusin" @focusout="onRowFocusout">
        <span class="lpHandleCell">
            <div class="lpItemHandle lpHandle" title="Reorder this item" />
        </span>
        <span v-if="optionalFields['images']" class="lpImageCell">
            <img v-if="thumbnailImage" class="lpItemImage" :src="thumbnailImage" @click="viewItemImage()">
        </span>
        <!-- !! matters: the directive treats undefined as "focus", and _isNew
             is undefined on rows loaded from a save. -->
        <input v-model="item.name" v-focus-on-create="!!categoryItem._isNew" type="text" class="lpName lpSilent" placeholder="Name" @input="saveItem">
        <input v-model="item.description" type="text" class="lpDescription lpSilent" placeholder="Description" @input="saveItem">
        <span class="lpActionsCell">
            <i class="lpSprite lpCamera" title="Upload a photo or use a photo from the web" @click="updateItemImage" />
            <i class="lpSprite lpLink" :class="{lpActive: item.url}" title="Add a link for this item" @click="updateItemLink" />
            <i v-if="optionalFields['worn']" class="lpSprite lpWorn" :class="{lpActive: categoryItem.worn}" title="Mark this item as worn" @click="toggleWorn" />
            <i v-if="optionalFields['consumable']" class="lpSprite lpConsumable" :class="{lpActive: categoryItem.consumable}" title="Mark this item as a consumable" @click="toggleConsumable" />
            <i :class="'lpSprite lpStar lpStar' + categoryItem.star" title="Star this item" @click="cycleStar" />
        </span>
        <span v-if="optionalFields['price']" class="lpPriceCell">
            <input v-model="displayPrice" v-empty-if-zero data-testid="item-price" type="text" :class="{lpPrice: true, lpNumber: true, lpSilent: true, lpSilentError: priceError}" @input="savePrice" @keydown.up="incrementPrice($event)" @keydown.down="decrementPrice($event)" @blur="setDisplayPrice">
        </span>
        <span class="lpWeightCell lpNumber">
            <input v-model="displayWeight" v-empty-if-zero data-testid="item-weight" type="text" :class="{lpWeight: true, lpNumber: true, lpSilent: true, lpSilentError: weightError}" @input="saveWeight" @keydown.up="incrementWeight($event)" @keydown.down="decrementWeight($event)">
            <unitSelect :unit="item.authorUnit" :on-change="setUnit" />
        </span>
        <span class="lpQtyCell">
            <input v-model="displayQty" data-testid="item-qty" type="text" :class="{lpQty: true, lpNumber: true, lpSilent: true, lpSilentError: qtyError, lpQtyMany: categoryItem.qty > 1}" @input="saveQty" @keydown.up="incrementQty($event)" @keydown.down="decrementQty($event)">
            <span class="lpArrows">
                <span class="lpSprite lpUp" @click="incrementQty($event)" />
                <span class="lpSprite lpDown" @click="decrementQty($event)" />
            </span>
        </span>
        <span class="lpRemoveCell">
            <a class="lpRemove lpRemoveItem" title="Remove this item" @click="removeItem"><i class="lpSprite lpSpriteRemove" /></a>
        </span>
        <div v-if="showSharedBubble" class="lpItemHints lpItemHintsLeft">
            <div class="lpHintBubble lpSharedBubble" data-testid="shared-item-bubble">
                <span class="lpHintNotch" />
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1.5 1.5" /><path d="M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1.5-1.5" /></svg>
                <span class="lpHintText">
                    Also in
                    <template v-for="(name, index) in sharedListNames" :key="index">
                        <b>{{ name }}</b><template v-if="index < sharedListNames.length - 2">, </template><template v-else-if="index === sharedListNames.length - 2"> and </template>
                    </template>
                    <template v-if="sharedListMoreCount"> and {{ sharedListMoreCount }} more</template>
                    — edits update it everywhere.
                </span>
                <a class="lpSharedBubbleFork" data-testid="fork-item" @mousedown.prevent @click="forkItem">Edit a copy instead</a>
                <a class="lpHintDismiss" data-testid="shared-item-bubble-dismiss" title="Turn off this hint" aria-label="Turn off this hint" @mousedown.prevent @click="dismissSharedBubble"><i class="lpSprite lpSpriteRemove" /></a>
            </div>
        </div>
        <div v-if="showWornQtyHint" class="lpItemHints lpItemHintsRight">
            <div class="lpHintBubble lpWornQtyHint" data-testid="worn-qty-hint">
                <span class="lpHintNotch" />
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11.5v4.5" /><path d="M12 7.75v.5" /></svg>
                <span class="lpHintText">Only 1 of {{ categoryItem.qty }} counts as worn — the rest add to your pack weight.</span>
                <a class="lpHintDismiss" data-testid="worn-qty-hint-dismiss" title="Turn off this hint" aria-label="Turn off this hint" @mousedown.prevent @click="dismissWornQtyHint"><i class="lpSprite lpSpriteRemove" /></a>
            </div>
        </div>
    </li>
</template>

<script>
import unitSelect from './unit-select.vue';

import itemMixin from '../mixins/item-mixin.js';

export default {
    name: 'Item',
    components: {
        unitSelect,
    },
    mixins: [itemMixin],
};
</script>

<style lang="scss">
@import "../css/_globals";

.lpItem {
    border-bottom: 1px solid var(--lp-border);
    // Isolate so the row's two negative-z pseudos — the hover catcher
    // (&::before) and the active band (&::after) — resolve against this row,
    // landing above the list background but below the row's own content,
    // instead of escaping behind the whole list. Drop this and the band stops
    // painting altogether. The cost is that it also traps the unit dropdown in
    // here; see the z-index lift further down.
    isolation: isolate;
    padding: var(--lp-row-padding-y, 2px) 0;

    // Base quiet-input look comes from .lpSilent; fields stay bare until the
    // row's :focus-within reveals underlines (below). The inputs are the
    // tallest thing in the row, so their vertical padding — not the row's —
    // is what actually sets the row height.
    input {
        padding: var(--lp-row-input-padding-y, 3px) 7px;

        &:focus {
            background: var(--lp-bg);
            border-color: var(--lp-border-strong);
        }
    }

    .lpName {
        color: var(--lp-text);
        font-size: 13px;
        min-width: 0;
    }

    .lpDescription {
        color: var(--lp-text-secondary);
        font-size: 13px;
        min-width: 0;
    }

    .lpImageCell {
        .lpItemImage {
            cursor: pointer;
            display: block;
            max-width: 90px;
        }
    }

    .lpPriceCell input {
        color: var(--lp-text-secondary);
        font-size: 13px;
        font-variant-numeric: tabular-nums;
        text-align: right;
        width: 100%;
    }

    .lpWeightCell {
        align-items: baseline;
        display: flex;
        gap: 2px;
        justify-content: flex-end;

        .lpWeight {
            color: var(--lp-text);
            flex: 1 1 0;
            font-size: 13px;
            font-variant-numeric: tabular-nums;
            min-width: 0;
            text-align: right;
        }
    }

    // Unit reads as a faint label at rest; the caret is its only picker
    // affordance, revealed with the row's other chrome.
    .lpUnitSelect {
        padding: 0 2px;
        white-space: nowrap;

        .lpDisplay {
            color: var(--lp-text-secondary);
            font-size: 12px;
            width: auto;
        }

        i.lpExpand {
            visibility: hidden;
        }

        &:hover,
        &.lpHover {
            background: transparent;
            border-color: transparent;
        }
    }

    &:hover .lpUnitSelect i.lpExpand,
    &:focus-within .lpUnitSelect i.lpExpand {
        visibility: visible;
    }

    .lpQtyCell {
        position: relative;

        .lpQty {
            color: var(--lp-text-secondary);
            font-size: 13px;
            font-variant-numeric: tabular-nums;
            text-align: right;
            width: 100%;

            &.lpQtyMany {
                color: var(--lp-text);
                font-weight: 600;
            }
        }
    }

    // Flag columns: fixed slots so icons align down the table. Rest state is
    // empty; icons appear grey on row hover and colored when set.
    .lpActionsCell {
        align-items: center;
        display: flex;
        gap: 4px;

        i {
            cursor: pointer;
            flex: 0 0 18px;
            margin: 0;
            opacity: 0.4;
            visibility: hidden;

            &:hover {
                opacity: 1;
            }

            &.lpActive,
            &.lpStar1,
            &.lpStar2,
            &.lpStar3 {
                opacity: 1;
                visibility: visible;
            }
        }
    }

    // One hover target covering the row and both gutters — the drag handle, qty
    // stepper, remove ✕, and all the whitespace between them and the columns.
    // Invisible, and sits behind the inputs and controls (z-index below them, so
    // it intercepts nothing) but in front of the list background, so hovering
    // anywhere in the band keeps the row :hover. Without it the gutter controls
    // blink off the moment the cursor crosses the empty space to reach them.
    &::before {
        bottom: 0;
        content: "";
        left: -30px;
        position: absolute;
        right: -42px;
        top: 0;
        z-index: -1;
    }

    // A row reads as active while you're on it: hovering, editing one of its
    // fields, or with its unit picker open. The picker needs saying out loud —
    // clicking it moves focus off the row's inputs and the pointer wanders onto
    // the dropdown's own options, so neither :hover nor :focus-within can be
    // trusted to hold while it's open.
    &:hover,
    &:focus-within,
    &:has(.lpUnitSelect.lpOpen) {
        .lpRemove,
        .lpHandle,
        .lpArrows,
        .lpActionsCell i {
            visibility: visible;
        }
    }

    // The row band — a flat grey fill marking the hovered row and the row being
    // edited. Drawn as an out-of-flow layer (::after) inset a constant halo
    // around the row's padding box rather than by growing the row itself, so
    // the row's box is byte-identical banded or not: neighbors never bump,
    // columns never jump, and the absolutely-positioned gutter controls stay
    // put. The inset is a constant halo around the row box, so retuning the
    // row padding above moves the band with it. Sits below the row's content but
    // above its background and border (negative z-index inside the row's own
    // stacking context), so it covers the hairline divider for free.
    // Shared with dragula's mirror so a dragged row keeps a solid backing.
    // The horizontal insets sit 3px right of even (-9 left, -15 right): the qty
    // stepper bleeds into the right gutter, so a symmetric inset crowds it on
    // the right while leaving slack on the left.
    &:hover::after,
    &:focus-within::after,
    &:has(.lpUnitSelect.lpOpen)::after,
    &.gu-mirror::after {
        background: var(--lp-row-hover);
        content: "";
        inset: -3px -16px -3px -5px;
        position: absolute;
        z-index: -1;
    }

    // The unit dropdown is a tall menu inside the row, and `isolation` above
    // traps it in the row's stacking context, so its own z-index can't lift it
    // over the neighbours — the rows below paint on top and swallow the lower
    // options. Lift the whole row instead, above both resting rows and a
    // focused one (2), for as long as the picker is open.
    &:has(.lpUnitSelect.lpOpen) {
        z-index: 3;
    }

    &:focus-within {
        z-index: 2;

        // Fields stay borderless on the lifted card: underlining all of them
        // reads as five competing inputs when only one is being edited. The
        // card itself is the "this row is live" signal; the underline marks
        // the single field you're in.
        input {
            &.lpSilentError {
                border-color: var(--lp-danger);
            }
        }
    }

    // dragula's mirror — the clone that follows the cursor. It's parked inside
    // the source .lpItems (list.vue's mirrorContainer) rather than on <body>,
    // so the list-scoped rules that make a row a row — grid template, gutter
    // cells, column alignment — still match it. Only the drag-specific bits
    // live here; the card comes from the shared ::after above.
    &.gu-mirror {
        cursor: grabbing;
        // The card's own shadow reads as "lifted"; the 0.8 ghosting .gu-mirror
        // applies by default just makes it look washed out.
        opacity: 1;

        // Resting rows are flat, but this clone really is floating over the
        // list, so it keeps the lifted card: surface fill, rounded, shadowed.
        &::after {
            background: var(--lp-surface);
            border-radius: 7px;
            box-shadow: var(--lp-lift-shadow);
        }

        // You're holding it, so it stays lit even though nothing is hovered.
        .lpHandle {
            visibility: visible;
        }
    }
}

// Compact density, set in the Settings menu (list.vue puts the class on the
// list body). Squeezing the row's own padding only buys 4px, because the
// inputs are what the row is actually as tall as; taking 2px off each of them
// too lands rows 8px shorter, at the pre-redesign density. Type size, columns
// and the hover band's tuned bleed are all untouched, so the row reads the
// same — there's just less air around it.
.lpDensityCompact .lpItem {
    --lp-row-padding-y: 0;
    --lp-row-input-padding-y: 2px;
}

// Item hint bubbles: float below the lifted row and overlap the next row.
// The shared-item hint anchors left, by the name being edited; the worn-qty
// hint anchors right, under the qty input it describes. Each is its own
// absolutely-positioned box, so both can show at once without colliding.
.lpItemHints {
    display: flex;
    position: absolute;
    top: calc(100% + 5px);
    z-index: 3;

    &.lpItemHintsLeft {
        left: 10px;
    }

    &.lpItemHintsRight {
        right: 0;
    }
}

.lpHintBubble {
    align-items: center;
    background: var(--lp-bubble-bg);
    border: 1px solid var(--lp-bubble-border);
    border-radius: 6px;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
    color: var(--lp-bubble-text);
    display: flex;
    font-size: 11.5px;
    gap: 7px;
    padding: 6px 11px;
    position: relative;
    white-space: nowrap;

    svg {
        color: var(--lp-accent-green-deep);
        flex: 0 0 auto;
    }
}

.lpHintNotch {
    background: var(--lp-bubble-bg);
    border-left: 1px solid var(--lp-bubble-border);
    border-top: 1px solid var(--lp-bubble-border);
    height: 8px;
    left: 26px;
    position: absolute;
    top: -4.5px;
    transform: rotate(45deg);
    width: 8px;
}

// Right-anchored worn-qty bubble points its notch up at the qty input, which
// sits at the row's right edge (its column is the last one before the gutter).
.lpItemHintsRight .lpHintNotch {
    left: auto;
    right: 10px;
}

.lpSharedBubbleFork {
    color: var(--lp-bubble-text);
    cursor: pointer;
    font-weight: 700;

    &:hover {
        text-decoration: underline;
    }
}

// Dismiss ✕: reuses the shared x.svg mask glyph (via .lpSpriteRemove), muted at
// rest so it reads as secondary to the bubble's message and darkening on hover.
// The .lpSprite mask fills currentColor, so color here drives the glyph.
.lpHintDismiss {
    align-items: center;
    color: var(--lp-icon-rest);
    cursor: pointer;
    display: flex;
    flex: 0 0 auto;
    margin-left: 1px;

    &:hover {
        color: var(--lp-bubble-text);
    }

    .lpSprite {
        height: 11px;
        width: 11px;
    }
}

// Qty stepper: sits just right of the number, in the gutter, clear of the ✕
// beyond. It stays hovered and clickable via .lpItem's row-wide hover catcher
// (see &::before) rather than having to reach back into the columns itself.
.lpArrows {
    height: 24px;
    position: absolute;
    right: -10px;
    top: 50%;
    transform: translateY(-50%);
    visibility: hidden;
    width: 9px;

    .lpUp,
    .lpDown {
        cursor: pointer;
        left: 1px;
        opacity: 0.5;
        position: absolute;

        &:hover {
            opacity: 1;
        }
    }

    .lpUp {
        top: 3px;
    }

    .lpDown {
        top: 14px;
    }
}
</style>
