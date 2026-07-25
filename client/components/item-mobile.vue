<template>
    <li
        :id="item.id"
        class="lpItemMobile"
        :class="{lpItemMobileEditing: rowFocused}"
        data-testid="item-row"
    >
        <!-- Rest state. Plain text, not inputs: it keeps 300-row lists cheap,
             and it lets the row sit at the design's 13.5px without iOS zooming
             the viewport the moment something takes focus. The whole band is
             one tap target — picking out a 13px field with a thumb isn't a
             real interaction. -->
        <div v-if="!rowFocused" class="lpItemMobileRest" data-testid="item-rest" @click="startEditing($event)">
            <span v-if="showThumb" class="lpItemMobileThumb" @click.stop="viewItemImage()">
                <img :src="thumbnailImage" :alt="item.name">
                <span v-if="categoryItem.qty > 1" class="lpItemMobileBadge">{{ categoryItem.qty }}</span>
            </span>
            <span class="lpItemMobileBody">
                <span class="lpItemMobileTitle">
                    <span class="lpItemMobileName">{{ item.name || 'New item' }}</span>
                    <span v-if="!showThumb && categoryItem.qty > 1" class="lpItemMobileQty">×{{ categoryItem.qty }}</span>
                    <!-- Only flags that are actually set. Unset ones live on
                         the desktop's hover reveal, which has no counterpart
                         here; the editor below is where you turn them on. -->
                    <i v-if="optionalFields['worn'] && categoryItem.worn" class="lpSprite lpWorn lpActive" title="Worn" />
                    <i v-if="optionalFields['consumable'] && categoryItem.consumable" class="lpSprite lpConsumable lpActive" title="Consumable" />
                    <i v-if="categoryItem.star" :class="'lpSprite lpStar lpStar' + categoryItem.star" title="Starred" />
                    <i v-if="item.url" class="lpSprite lpLink lpActive" title="Has a link" />
                </span>
                <span v-if="item.description" class="lpItemMobileDesc">{{ item.description }}</span>
            </span>
            <span v-if="optionalFields['price']" class="lpItemMobilePrice">{{ formattedPrice }}</span>
            <span class="lpItemMobileWeight">
                {{ displayWeight }}
                <span class="lpItemMobileUnit">{{ item.authorUnit }}</span>
            </span>
        </div>

        <!-- Edit state (#11d): same row, opened up. Commits as you type, like
             the desktop row; tapping outside just closes it. -->
        <div v-else class="lpItemMobileEditor" data-testid="item-editor">
            <div class="lpItemMobileEditorTop">
                <span v-if="showThumb" class="lpItemMobileThumb" @click="updateItemImage">
                    <img :src="thumbnailImage" :alt="item.name">
                    <span class="lpItemMobileBadge lpItemMobileBadgeEdit">✎</span>
                </span>
                <input
                    v-model="item.name"
                    v-focus-on-create
                    type="text"
                    class="lpName lpSilent lpItemMobileField lpItemMobileFieldActive"
                    placeholder="Name"
                    @input="saveItem"
                >
                <input
                    v-model="displayWeight"
                    v-empty-if-zero
                    data-testid="item-weight"
                    type="text"
                    inputmode="decimal"
                    :class="{lpWeight: true, lpSilent: true, lpItemMobileField: true, lpItemMobileWeightField: true, lpSilentError: weightError}"
                    @input="saveWeight"
                >
                <unitSelect class="lpItemMobileUnitChip" :unit="item.authorUnit" :on-change="setUnit" />
            </div>

            <!-- #11c. Sits under the field being typed into rather than
                 floating above the keyboard: the browser scrolls the focused
                 input into view, so directly beneath it is reliably on screen,
                 and there's no guessing where the keyboard starts. -->
            <div v-if="suggestions.length" class="lpItemMobileSuggestions" data-testid="item-suggestions">
                <a
                    v-for="suggestion in suggestions"
                    :key="suggestion.id"
                    class="lpItemMobileSuggestion"
                    data-testid="item-suggestion"
                    @mousedown.prevent
                    @click="chooseSuggestion(suggestion)"
                >
                    <span class="lpItemMobileSuggestionName">
                        {{ suggestion.name }}
                        <span v-if="suggestion.description" class="lpItemMobileSuggestionDesc">· {{ suggestion.description }}</span>
                    </span>
                    <span class="lpItemMobileSuggestionMeta">{{ suggestionWeight(suggestion) }}</span>
                </a>
            </div>

            <div class="lpItemMobileEditorMid">
                <input
                    v-model="item.description"
                    type="text"
                    class="lpDescription lpSilent lpItemMobileField"
                    placeholder="Description"
                    @input="saveItem"
                >
                <label v-if="optionalFields['price']" class="lpItemMobileInline">
                    <span class="lpItemMobileInlineLabel">{{ library.currencySymbol }}</span>
                    <input
                        v-model="displayPrice"
                        v-empty-if-zero
                        data-testid="item-price"
                        type="text"
                        inputmode="decimal"
                        :class="{lpPrice: true, lpSilent: true, lpItemMobileField: true, lpItemMobileNumField: true, lpSilentError: priceError}"
                        @input="savePrice"
                        @blur="setDisplayPrice"
                    >
                </label>
                <label class="lpItemMobileInline">
                    <span class="lpItemMobileInlineLabel">×</span>
                    <input
                        v-model="displayQty"
                        data-testid="item-qty"
                        type="text"
                        inputmode="numeric"
                        :class="{lpQty: true, lpSilent: true, lpItemMobileField: true, lpItemMobileNumField: true, lpSilentError: qtyError}"
                        @input="saveQty"
                    >
                </label>
            </div>

            <!-- Flags get their own row at full touch size. mousedown.prevent
                 keeps the focused field from blurring as they're tapped, which
                 would otherwise close the editor out from under the tap. -->
            <div class="lpItemMobileEditorFlags">
                <a
                    v-if="optionalFields['worn']"
                    class="lpItemMobileFlag"
                    title="Mark this item as worn"
                    @mousedown.prevent
                    @click="toggleWorn"
                ><i class="lpSprite lpWorn" :class="{lpActive: categoryItem.worn}" /></a>
                <a
                    v-if="optionalFields['consumable']"
                    class="lpItemMobileFlag"
                    title="Mark this item as a consumable"
                    @mousedown.prevent
                    @click="toggleConsumable"
                ><i class="lpSprite lpConsumable" :class="{lpActive: categoryItem.consumable}" /></a>
                <a
                    class="lpItemMobileFlag"
                    title="Star this item"
                    @mousedown.prevent
                    @click="cycleStar"
                ><i :class="'lpSprite lpStar lpStar' + categoryItem.star" /></a>
                <a
                    class="lpItemMobileFlag"
                    title="Upload a photo or use a photo from the web"
                    @mousedown.prevent
                    @click="updateItemImage"
                ><i class="lpSprite lpCamera" /></a>
                <a
                    class="lpItemMobileFlag"
                    title="Add a link for this item"
                    @mousedown.prevent
                    @click="updateItemLink"
                ><i class="lpSprite lpLink" :class="{lpActive: item.url}" /></a>

                <span class="lpItemMobileFlagSpacer" />

                <!-- The design has no trash in the editor — removal lives in
                     the swipe gesture (#11e), which isn't built yet. Until it
                     is, this is the only way to take an item out of the list
                     from a phone. -->
                <a
                    class="lpItemMobileFlag lpItemMobileRemove"
                    data-testid="mobile-remove-item"
                    title="Remove this item from the list"
                    @mousedown.prevent
                    @click="removeItem"
                >Remove</a>
            </div>
        </div>

        <div v-if="showSharedBubble" class="lpItemMobileHint">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1.5 1.5" /><path d="M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1.5-1.5" /></svg>
            <span class="lpItemMobileHintText">
                Also in
                <template v-for="(name, index) in sharedListNames" :key="index">
                    <b>{{ name }}</b><template v-if="index < sharedListNames.length - 2">, </template><template v-else-if="index === sharedListNames.length - 2"> and </template>
                </template>
                <template v-if="sharedListMoreCount"> and {{ sharedListMoreCount }} more</template>
                — edits update it everywhere.
            </span>
            <a class="lpItemMobileHintFork" data-testid="fork-item" @mousedown.prevent @click="forkItem">Edit a copy</a>
        </div>

        <div v-if="showWornQtyHint" class="lpItemMobileHint">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11.5v4.5" /><path d="M12 7.75v.5" /></svg>
            <span class="lpItemMobileHintText">Only 1 of {{ categoryItem.qty }} counts as worn — the rest add to your pack weight.</span>
        </div>
    </li>
</template>

<script>
import unitSelect from './unit-select.vue';

import itemMixin from '../mixins/item-mixin.js';
import weightUtils from '../utils/weight.js';

const minSuggestionChars = 2;
const maxSuggestions = 6;

// The tap that opens a row bubbles up to the document dismissers as well, and
// by then the rest row it hit has been replaced by the editor — so a plain
// containment test sees a detached target and reads it as an outside tap.
// Recording which row a tap opened lets that row ignore it while every other
// open row still closes. Keyed by event, weakly, so nothing outlives dispatch.
const openingTaps = new WeakMap();

export default {
    name: 'ItemMobile',
    components: {
        unitSelect,
    },
    mixins: [itemMixin],
    data() {
        return {
            openOnMount: false,
        };
    },
    computed: {
        // Only a row that's still empty apart from the name being typed is an
        // "add" — anything with a weight, price, description or media is an
        // established item, and offering to replace it would be destructive.
        isUnfilled() {
            return !this.item.weight
                && !this.item.price
                && !this.item.description
                && !this.item.url
                && !this.item.image
                && !this.item.imageUrl;
        },
        // Gear the typed name matches, drawn from the library the user already
        // has. Name matches rank above description matches, and a name that
        // starts with what's typed ranks above one that merely contains it.
        suggestions() {
            const query = (this.item.name || '').trim().toLowerCase();
            if (!this.rowFocused || !this.isUnfilled || query.length < minSuggestionChars) {
                return [];
            }

            const alreadyPlaced = this.library.getItemsInCurrentList();
            const scored = [];

            this.library.items.forEach((candidate) => {
                if (candidate.id === this.item.id || alreadyPlaced.indexOf(candidate.id) > -1) {
                    return;
                }
                const name = (candidate.name || '').toLowerCase();
                const description = (candidate.description || '').toLowerCase();

                let rank;
                if (name.indexOf(query) === 0) rank = 0;
                else if (name.indexOf(query) > 0) rank = 1;
                else if (description.indexOf(query) > -1) rank = 2;
                else return;

                scored.push({ candidate, rank });
            });

            // Within a rank, the shorter name wins: the query covers more of
            // it, so it's the tighter match. "pil" offers Pillow before Pill
            // organizer, which alphabetical order would have inverted.
            return scored
                .sort((a, b) => a.rank - b.rank
                    || a.candidate.name.length - b.candidate.name.length
                    || a.candidate.name.localeCompare(b.candidate.name))
                .slice(0, maxSuggestions)
                .map(entry => entry.candidate);
        },
        showThumb() {
            return this.optionalFields.images && !!this.thumbnailImage;
        },
        // Unit price, matching the design — the ×qty is shown separately, so
        // multiplying here would double-count it visually. Whole amounts drop
        // the ".00"; at this density the zeros are noise.
        formattedPrice() {
            const price = typeof this.item.price === 'number' ? this.item.price : 0;
            const amount = Number.isInteger(price) ? String(price) : price.toFixed(2);
            return `${this.library.currencySymbol}${amount}`;
        },
    },
    // _isNew is set by the newItem mutation and cleared by the mixin's
    // mounted hook, which runs before this component's — so it has to be read
    // here, in beforeMount, while it's still true.
    beforeMount() {
        this.openOnMount = !!this.itemContainer.categoryItem._isNew;
    },
    mounted() {
        if (this.openOnMount) {
            this.rowFocused = true;
            // The click that added the row is still bubbling. Binding the
            // dismisser now would let that same click close the editor, since
            // "+ Add new item" sits outside this row.
            requestAnimationFrame(() => {
                if (this.rowFocused) {
                    this.bindDismiss();
                }
            });
        }
    },
    beforeUnmount() {
        this.unbindDismiss();
    },
    methods: {
        suggestionWeight(suggestion) {
            return `${weightUtils.MgToWeight(suggestion.weight, suggestion.authorUnit)} ${suggestion.authorUnit}`;
        },
        // Links the row to the gear that was picked rather than copying its
        // values across. Copying would leave a second library entry with the
        // same name, which is the duplication the gear library exists to
        // avoid — and it's what dragging from the rail does on the desktop.
        // The blank row this replaces is deleted outright: removeItemFromCategory
        // would detach it but leave an unnamed orphan behind in the library.
        chooseSuggestion(suggestion) {
            const { category } = this;
            const blank = this.item;
            const at = category.categoryItems.findIndex(entry => entry.itemId === blank.id);

            this.rowFocused = false;
            this.unbindDismiss();

            this.$store.commit('removeItem', blank);
            this.$store.commit('addItemToCategory', {
                itemId: suggestion.id,
                categoryId: category.id,
                dropIndex: at === -1 ? category.categoryItems.length : at,
            });
        },
        startEditing(evt) {
            openingTaps.set(evt, this);
            this.slideTo(() => {
                this.rowFocused = true;
                this.bindDismiss();
            });
        },
        stopEditing() {
            if (!this.rowFocused) {
                return;
            }
            this.slideTo(() => {
                this.rowFocused = false;
                this.unbindDismiss();
            });
        },
        // Grows and shrinks the row between its two states rather than jumping.
        // Neither state has a known height, so both are measured around the
        // swap and the row is driven explicitly for the duration — the same
        // trick the summary panel uses, and for the same reason: `auto` can't
        // be transitioned.
        slideTo(change) {
            const el = this.$el;
            const from = el.getBoundingClientRect().height;

            change();

            this.$nextTick(() => {
                // Clear any height left by an interrupted slide before
                // measuring, or `to` is the previous animation's target.
                el.style.height = 'auto';
                const to = el.getBoundingClientRect().height;

                if (Math.abs(to - from) < 1) {
                    el.style.height = '';
                    return; // nothing to animate, and no transitionend coming
                }

                el.style.overflow = 'hidden';
                el.style.height = `${from}px`;
                const _reflow = el.offsetHeight;
                el.style.height = `${to}px`;

                el.removeEventListener('transitionend', el._lpSlideEnd);
                el._lpSlideEnd = (evt) => {
                    if (evt.target !== el || evt.propertyName !== 'height') {
                        return;
                    }
                    // Back to auto, so the row still tracks its contents —
                    // a hint bubble appearing, a description wrapping.
                    el.style.height = '';
                    el.style.overflow = '';
                    el.removeEventListener('transitionend', el._lpSlideEnd);
                };
                el.addEventListener('transitionend', el._lpSlideEnd);
            });
        },
        // Dismissal listens for the same click that opens a row, in the bubble
        // phase, so the row's own handler has already run by the time this
        // fires. Doing it on pointerdown instead re-rendered the list between
        // pointerdown and click, which moved the row out from under the tap —
        // opening a second row while one was open then closed the first
        // without opening the second.
        //
        // Bound on demand, so an open editor costs one listener rather than
        // one per row in a 300-item list.
        bindDismiss() {
            document.addEventListener('click', this.onDocumentClick);
        },
        unbindDismiss() {
            document.removeEventListener('click', this.onDocumentClick);
        },
        onDocumentClick(evt) {
            if (openingTaps.get(evt) === this) {
                return; // the tap that opened this row
            }
            if (this.$el.contains(evt.target)) {
                return; // landed inside the open editor
            }
            this.stopEditing();
        },
    },
};
</script>

<style lang="scss">
@import "../css/_globals";

// ============================================================
// The phone item row (#11a rest, #18a weight bar, #11d editor)
//
// Rendered instead of item.vue below $mobile — see client/utils/viewport.js.
// The desktop row is a grid of live inputs in fixed columns; this one is two
// lines of text that opens into an editor, so it shares logic with that row
// (item-mixin.js) but none of its layout.
// ============================================================
.lpItemMobile {
    border-bottom: 1px solid var(--lp-border);
    list-style: none;
    position: relative;
    // The row slides between its two heights while the tint and green edge
    // fade in behind it. Height is driven from slideTo(); the transition is
    // declared here so both directions pick it up.
    transition: height $transitionDuration ease, background-color $transitionDuration, box-shadow $transitionDuration;
}

.lpItemMobileRest {
    align-items: center;
    cursor: pointer;
    display: flex;
    gap: 10px;
    padding: 6px 14px;
}

.lpItemMobileThumb {
    flex: 0 0 auto;
    height: 30px;
    position: relative;
    width: 30px;

    img {
        border-radius: 2px;
        display: block;
        height: 100%;
        object-fit: cover;
        width: 100%;
    }
}

// Quantity rides the thumbnail when there is one, keeping the title line clear
// for the name and its flags.
.lpItemMobileBadge {
    align-items: center;
    background: var(--lp-sidebar-bg);
    border: 1.5px solid var(--lp-content-bg);
    border-radius: 8px;
    color: $grey-0;
    display: flex;
    font-size: 9.5px;
    font-weight: 700;
    height: 15px;
    justify-content: center;
    min-width: 15px;
    padding: 0 3px;
    position: absolute;
    right: -6px;
    top: -5px;
}

.lpItemMobileBadgeEdit {
    bottom: -4px;
    font-weight: 400;
    right: -4px;
    top: auto;
}

.lpItemMobileBody {
    flex: 1 1 auto;
    line-height: 1.3;
    min-width: 0;
}

.lpItemMobileTitle {
    align-items: center;
    display: flex;
    gap: 5px;
    min-width: 0;

    .lpSprite {
        flex: 0 0 auto;
        height: 12px;
        top: 0;
        width: 12px;
    }
}

.lpItemMobileName {
    color: var(--lp-text);
    font-size: 13.5px;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

// Without a thumbnail to badge, quantity becomes a chip beside the name.
.lpItemMobileQty {
    background: var(--lp-sidebar-bg);
    border-radius: 8px;
    color: $grey-0;
    flex: 0 0 auto;
    font-size: 9.5px;
    font-weight: 700;
    padding: 1px 5px;
}

.lpItemMobileDesc {
    color: var(--lp-text-secondary);
    display: block;
    font-size: 11.5px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.lpItemMobilePrice {
    color: var(--lp-text-secondary);
    flex: 0 0 auto;
    font-size: 11.5px;
    font-variant-numeric: tabular-nums;
}

.lpItemMobileWeight {
    color: var(--lp-text);
    flex: 0 0 auto;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    min-width: 54px;
    text-align: right;
}

.lpItemMobileUnit {
    color: var(--lp-text-secondary);
    font-size: 10.5px;
}

// --- Edit state ---------------------------------------------

.lpItemMobileEditing {
    // Same green edge and tinted surface the design gives the open row; the
    // tokens are the app's, so it re-themes with everything else.
    background: var(--lp-bubble-bg);
    box-shadow: inset 3px 0 0 var(--lp-accent-green-deep);
}

// Fade only — the row's height slide already supplies the movement, and
// sliding the contents on top of it was the jarring part.
.lpItemMobileEditor {
    animation: lpItemMobileEditorIn $transitionDuration ease-out;
    padding: 8px 14px 4px;
}

@keyframes lpItemMobileEditorIn {
    from {
        opacity: 0;
    }

    to {
        opacity: 1;
    }
}

.lpItemMobileEditorTop,
.lpItemMobileEditorMid {
    align-items: center;
    display: flex;
    gap: 10px;
}

.lpItemMobileEditorMid {
    gap: 12px;
    margin-top: 9px;
}

// A single scrolling row, not a wrapping list: it keeps the editor's height
// steady no matter how many matches there are, so the row doesn't jump around
// under the finger as the query narrows.
.lpItemMobileSuggestions {
    display: flex;
    gap: 8px;
    margin: 10px -14px 0;
    overflow-x: auto;
    padding: 0 14px 2px;
    scrollbar-width: none;

    &::-webkit-scrollbar {
        display: none;
    }
}

.lpItemMobileSuggestion {
    background: var(--lp-surface);
    border: 1px solid var(--lp-border-strong);
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    flex: 0 0 auto;
    flex-direction: column;
    gap: 1px;
    max-width: 230px;
    padding: 7px 11px;
    text-decoration: none;
}

.lpItemMobileSuggestionName {
    color: var(--lp-text);
    font-size: 13px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.lpItemMobileSuggestionDesc {
    color: var(--lp-text-secondary);
    font-weight: 400;
}

.lpItemMobileSuggestionMeta {
    color: var(--lp-accent-green-deep);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
}

// Every field in the editor is a real input, so all of them clear iOS
// Safari's 16px zoom threshold — anything smaller yanks the viewport on
// focus. Underlines only, no boxes, per the design.
.lpItemMobileField {
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--lp-border-strong);
    border-radius: 0;
    flex: 1 1 auto;
    font-size: 16px;
    min-width: 0;
    padding: 2px 0 3px;

    &:focus {
        border-bottom-color: var(--lp-accent-green-deep);
        border-bottom-width: 1.5px;
        outline: none;
        padding-bottom: 2.5px;
    }
}

.lpItemMobileFieldActive {
    border-bottom-color: var(--lp-accent-green-deep);
    border-bottom-width: 1.5px;
    padding-bottom: 2.5px;
}

.lpItemMobileWeightField,
.lpItemMobileNumField {
    flex: 0 0 auto;
    font-variant-numeric: tabular-nums;
    text-align: right;
    width: 52px;
}

.lpItemMobileNumField {
    width: 44px;
}

.lpItemMobileInline {
    align-items: center;
    color: var(--lp-text-secondary);
    display: flex;
    flex: 0 0 auto;
    gap: 3px;
}

.lpItemMobileInlineLabel {
    font-size: 13px;
}

// The unit picker becomes a real chip — the desktop's bare caret is a hover
// affordance and far under a thumb-sized target.
.lpItemMobileUnitChip.lpUnitSelect {
    background: var(--lp-surface);
    border: 1px solid var(--lp-border-strong);
    border-radius: 5px;
    flex: 0 0 auto;
    font-size: 12.5px;
    font-weight: 600;
    padding: 8px 11px;

    .lpDisplay {
        width: auto;
    }
}

.lpItemMobileEditorFlags {
    align-items: center;
    display: flex;
    margin-top: 6px;
}

.lpItemMobileFlag {
    align-items: center;
    color: var(--lp-icon-rest);
    cursor: pointer;
    display: flex;
    flex: 0 0 auto;
    height: 44px;
    justify-content: center;
    width: 44px;

    .lpSprite {
        height: 17px;
        opacity: 1;
        top: 0;
        visibility: visible;
        width: 17px;
    }
}

.lpItemMobileFlagSpacer {
    flex: 1 1 auto;
}

.lpItemMobileRemove {
    color: var(--lp-danger);
    font-size: 12.5px;
    font-weight: 600;
    width: auto;
}

// --- Hints --------------------------------------------------
// The desktop floats these below the lifted row, overlapping the next one.
// There's no room to overlap at this width, so they sit in flow under the
// open editor and push the list down while it's open.
.lpItemMobileHint {
    align-items: flex-start;
    background: var(--lp-bubble-bg);
    color: var(--lp-bubble-text);
    display: flex;
    font-size: 11.5px;
    gap: 7px;
    line-height: 1.4;
    padding: 7px 14px 9px;

    svg {
        flex: 0 0 auto;
        margin-top: 2px;
    }
}

.lpItemMobileHintText {
    flex: 1 1 auto;
}

.lpItemMobileHintFork {
    color: var(--lp-bubble-text);
    cursor: pointer;
    flex: 0 0 auto;
    font-weight: 700;
    white-space: nowrap;
}
</style>
