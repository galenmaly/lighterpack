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

import weightUtils from '../utils/weight.js';

const maxSharedListNames = 2;

export default {
    name: 'Item',
    components: {
        unitSelect,
    },
    inject: ['openItemImage', 'openItemViewImage', 'openItemLink'],
    props: ['category', 'itemContainer'],
    data() {
        return {
            displayWeight: 0,
            displayPrice: 0,
            displayQty: 0,
            weightError: false,
            priceError: false,
            qtyError: false,
            numStars: 4,
            rowFocused: false,
        };
    },
    computed: {
        library() {
            return this.$store.state.library;
        },
        optionalFields() {
            return this.$store.getters.optionalFields;
        },
        item() {
            return Object.assign({}, this.itemContainer.item);
        },
        categoryItem() {
            return Object.assign({}, this.itemContainer.categoryItem);
        },
        thumbnailImage() {
            if (this.item.image) {
                return `https://i.imgur.com/${this.item.image}s.jpg`;
            } if (this.item.imageUrl) {
                // Locally hosted uploads have a _t thumbnail variant;
                // external URLs don't. (Mirrored in server/images.js.)
                if (this.item.imageUrl.indexOf('/userimages/') === 0) {
                    return this.item.imageUrl.replace(/\.webp$/, '_t.webp');
                }
                return this.item.imageUrl;
            }
            return '';
        },
        fullImage() {
            if (this.item.image) {
                return `https://i.imgur.com/${this.item.image}l.jpg`;
            } if (this.item.imageUrl) {
                return this.item.imageUrl;
            }
            return '';
        },
        otherListsWithItem() {
            return this.library.getListsContainingItem(this.item.id)
                .filter((list) => list.id !== this.library.defaultListId);
        },
        sharedListNames() {
            return this.otherListsWithItem
                .slice(0, maxSharedListNames)
                .map((list) => list.name || 'New list');
        },
        sharedListMoreCount() {
            return Math.max(0, this.otherListsWithItem.length - maxSharedListNames);
        },
        showSharedBubble() {
            return this.rowFocused && this.otherListsWithItem.length > 0 && this.library.preferences.sharedItemBubble;
        },
        showWornQtyHint() {
            // Worn weight only counts one unit (see Category.calculateSubtotal),
            // so flag the surprise when a worn item has qty > 1. Gated on the
            // worn field being shown, since otherwise worn weight isn't computed.
            return this.rowFocused
                && this.optionalFields.worn
                && this.categoryItem.worn
                && this.categoryItem.qty > 1
                && this.library.preferences.wornQtyHint;
        },
    },
    watch: {
        item() {
            this.setDisplayWeight();
        },
        categoryItem() {
            this.setDisplayQty();
        },
    },
    beforeMount() {
        this.setDisplayWeight();
        this.setDisplayPrice();
        this.setDisplayQty();
    },
    mounted() {
        // _isNew exists only so v-focus-on-create focuses a freshly added row.
        // Clear it after that first mount, or every remount (e.g. switching
        // lists) steals focus back to this row.
        if (this.itemContainer.categoryItem._isNew) {
            this.$store.commit('updateCategoryItem', {
                category: this.category,
                categoryItem: Object.assign({}, this.itemContainer.categoryItem, { _isNew: false }),
            });
        }
    },
    methods: {
        saveItem() {
            this.$store.commit('updateItem', this.item);
        },
        saveCategoryItem() {
            this.$store.commit('updateCategoryItem', { category: this.category, categoryItem: this.categoryItem });
        },
        onRowFocusin() {
            this.rowFocused = true;
        },
        onRowFocusout(evt) {
            if (!evt.currentTarget.contains(evt.relatedTarget)) {
                this.rowFocused = false;
            }
        },
        forkItem() {
            // Remember which field is being edited so focus can survive the
            // row remounting under the forked item's id.
            const active = document.activeElement;
            const fieldClasses = ['lpName', 'lpDescription', 'lpPrice', 'lpWeight', 'lpQty'];
            const focusedField = (active && fieldClasses.find((cls) => active.classList.contains(cls))) || 'lpName';

            this.$store.commit('forkItem', { itemId: this.item.id, listId: this.library.defaultListId });

            const newItemId = this.itemContainer.categoryItem.itemId;
            this.$nextTick(() => {
                const row = document.getElementById(String(newItemId));
                const input = row && row.querySelector(`input.${focusedField}`);
                if (input) input.focus();
            });
        },
        dismissSharedBubble() {
            // The ✕ turns the hint off for good, not just for this row. A bubble
            // only renders while its preference is on, so a toggle reliably flips
            // it off — and the Account Settings checkbox can turn it back on.
            this.$store.commit('togglePreference', 'sharedItemBubble');
        },
        dismissWornQtyHint() {
            this.$store.commit('togglePreference', 'wornQtyHint');
        },
        setUnit(unit) {
            this.item.authorUnit = unit;
            this.$store.commit('updateItemUnit', unit);
            this.saveWeight(); // calling saveWeight preserves the text in the weight box instead of converting units.
        },
        savePrice() {
            const priceFloat = parseFloat(this.displayPrice, 10);

            if (!isNaN(priceFloat)) {
                this.item.price = Math.round(priceFloat * 100) / 100;
                this.saveItem();
                this.priceError = false;
            } else {
                this.priceError = true;
            }
        },
        saveQty() {
            const qtyFloat = parseFloat(this.displayQty, 10);

            if (!isNaN(qtyFloat)) {
                this.categoryItem.qty = qtyFloat;
                this.saveCategoryItem();
                this.qtyError = false;
            } else {
                this.qtyError = true;
            }
        },
        saveWeight() {
            const weightFloat = parseFloat(this.displayWeight, 10);

            if (!isNaN(weightFloat)) {
                this.item.weight = weightUtils.WeightToMg(weightFloat, this.item.authorUnit);
                this.saveItem();
                this.weightError = false;
            } else {
                this.weightError = true;
            }
        },
        setDisplayPrice() {
            if (!this.priceError) {
                this.displayPrice = this.item.price.toFixed(2);
            }
        },
        setDisplayQty() {
            if (!this.qtyError) {
                this.displayQty = this.categoryItem.qty;
            }
        },
        setDisplayWeight() {
            this.displayWeight = weightUtils.MgToWeight(this.item.weight, this.item.authorUnit);
        },
        updateItemLink() {
            this.openItemLink(this.item);
        },
        updateItemImage() {
            this.openItemImage(this.item);
        },
        viewItemImage() {
            this.openItemViewImage(this.fullImage);
        },
        toggleWorn() {
            if (this.categoryItem.consumable) {
                return;
            }
            this.categoryItem.worn = !this.categoryItem.worn;
            this.saveCategoryItem();
        },
        toggleConsumable() {
            if (this.categoryItem.worn) {
                return;
            }
            this.categoryItem.consumable = !this.categoryItem.consumable;
            this.saveCategoryItem();
        },
        cycleStar() {
            if (!this.categoryItem.star) {
                this.categoryItem.star = 0;
            }
            this.categoryItem.star = (this.categoryItem.star + 1) % this.numStars;
            this.saveCategoryItem();
        },
        incrementPrice(evt) {
            evt.stopImmediatePropagation();

            if (this.priceError) {
                return;
            }

            this.item.price = this.item.price + 1;

            this.saveItem();
            this.setDisplayPrice();
        },
        decrementPrice(evt) {
            evt.stopImmediatePropagation();

            if (this.priceError) {
                return;
            }

            this.item.price = this.item.price - 1;

            if (this.item.price < 0) {
                this.item.price = 0;
            }

            this.saveItem();
            this.setDisplayPrice();
        },
        incrementQty(evt) {
            evt.stopImmediatePropagation();

            if (this.qtyError) {
                return;
            }

            this.categoryItem.qty = this.categoryItem.qty + 1;
            this.saveCategoryItem();
        },
        decrementQty(evt) {
            evt.stopImmediatePropagation();

            if (this.qtyError) {
                return;
            }

            this.categoryItem.qty = this.categoryItem.qty - 1;

            if (this.categoryItem.qty < 0) {
                this.categoryItem.qty = 0;
            }

            this.saveCategoryItem();
        },
        incrementWeight(evt) {
            evt.stopImmediatePropagation();

            if (this.weightError) {
                return;
            }

            const newWeight = weightUtils.MgToWeight(this.item.weight, this.item.authorUnit) + 1;
            this.item.weight = weightUtils.WeightToMg(newWeight, this.item.authorUnit);

            this.saveItem();
        },
        decrementWeight(evt) {
            evt.stopImmediatePropagation();

            if (this.weightError) {
                return;
            }

            const newWeight = weightUtils.MgToWeight(this.item.weight, this.item.authorUnit) - 1;
            this.item.weight = weightUtils.WeightToMg(newWeight, this.item.authorUnit);

            if (this.item.weight < 0) {
                this.item.weight = 0;
            }

            this.saveItem();
        },
        removeItem() {
            this.$store.commit('removeItemFromCategory', { itemId: this.item.id, category: this.category });
        },
    },
};
</script>

<style lang="scss">
@import "../css/_globals";

.lpItem {
    border-bottom: 1px solid var(--lp-border);
    // Isolate so the row-wide hover catcher (&::before) resolves its negative
    // z-index against this row — landing above the list background but below
    // the row's own content — instead of escaping behind the whole list.
    isolation: isolate;
    padding: 5px 0 2px;

    // Base quiet-input look comes from .lpSilent; fields stay bare until the
    // row's :focus-within reveals underlines (below).
    input {
        padding: 0 2px 2px;
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

    // Unit reads as a faint label at rest; the picker affordance (caret,
    // dotted underline) appears with the row's other chrome.
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

    &:focus-within .lpUnitSelect {
        border-bottom: 1px dotted var(--lp-icon-rest);
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

    &:hover,
    &:focus-within {
        .lpRemove,
        .lpHandle,
        .lpArrows,
        .lpActionsCell i {
            visibility: visible;
        }
    }

    // The lifted row: pure visual state, zero layout shift. Negative margins
    // are compensated by padding, so columns and neighbors never move — and
    // the absolutely-positioned gutter controls stay put too, because their
    // offsets are relative to the padding box, which doesn't shift.
    &:focus-within {
        background: var(--lp-surface);
        border-bottom-color: transparent;
        border-radius: 7px;
        box-shadow: var(--lp-lift-shadow);
        margin: -2px -12px;
        padding: 8px 12px;
        z-index: 2;

        input {
            border-bottom-color: var(--lp-border);

            &:focus {
                border-bottom-color: var(--lp-accent-green-deep);
            }

            &.lpSilentError {
                border-bottom-color: var(--lp-danger);
            }
        }
    }
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
        top: 2px;
    }

    .lpDown {
        top: 13px;
    }
}
</style>
