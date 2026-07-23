<template>
    <li :id="category.id" class="lpCategory" data-testid="category">
        <ul class="lpItems lpDataTable" :class="{lpHasPrice: optionalFields['price'], lpHasImages: optionalFields['images']}">
            <li class="lpHeader lpItemsHeader">
                <span class="lpHandleCell">
                    <div class="lpHandle lpCategoryHandle" title="Reorder this category" />
                </span>
                <span class="lpCategoryHead">
                    <span v-if="swatchColor" class="lpCategorySwatch" :style="{background: swatchColor}" />
                    <input v-focus-on-create="!!category._isNew" type="text" :value="category.name" placeholder="Category Name" class="lpCategoryName lpSilent" @input="updateCategoryName">
                </span>
                <span v-if="optionalFields['price']" class="lpPriceCell lpNumber lpSubtotal">
                    {{ displayPrice(category.subtotalPrice, library.currencySymbol) }}
                </span>
                <span class="lpWeightCell lpNumber lpSubtotal">
                    <span class="lpDisplaySubtotal" data-testid="category-subtotal-weight">{{ displayWeight(category.subtotalWeight, library.totalUnit) }}</span>
                    <!-- Ghost caret mirrors the item rows' unit-picker metrics so the
                         subtotal number aligns with the item weights below it. -->
                    <span class="lpSubtotalUnit">{{ library.totalUnit }} <i class="lpSprite lpExpand lpGhostCaret" /></span>
                </span>
                <span class="lpQtyCell lpSubtotal">
                    <span class="lpQtySubtotal">{{ category.subtotalQty }}</span>
                </span>
                <span class="lpRemoveCell"><a class="lpRemove lpRemoveCategory" title="Remove this category" @click="removeCategory(category)"><i class="lpSprite lpSpriteRemove" /></a></span>
            </li>
            <item v-for="itemContainer in itemContainers" :key="itemContainer.item.id" :item-container="itemContainer" :category="category" />
            <li class="lpFooter lpItemsFooter">
                <span class="lpAddItemCell">
                    <a class="lpAdd lpAddItem" @click="newItem"><i class="lpSprite lpSpriteAdd" />Add new item</a>
                </span>
            </li>
        </ul>
    </li>
</template>

<script>
import item from './item.vue';

import utilsMixin from '../mixins/utils-mixin.js';

export default {
    name: 'Category',
    components: {
        item,
    },
    mixins: [utilsMixin],
    inject: ['initSpeedbump'],
    props: ['category'],
    computed: {
        library() {
            return this.$store.state.library;
        },
        optionalFields() {
            return this.$store.getters.optionalFields;
        },
        itemContainers() {
            return this.category.categoryItems.map(categoryItem => ({ categoryItem, item: this.library.getItemById(categoryItem.itemId) }));
        },
        swatchColor() {
            return this.category.displayColor || '';
        },
    },
    mounted() {
        // Same as item rows: _isNew only drives the one-time focus on create;
        // clear it so remounts don't refocus the category name.
        if (this.category._isNew) {
            this.$store.commit('clearCategoryIsNew', this.category.id);
        }
    },
    methods: {
        newItem() {
            this.$store.commit('newItem', { category: this.category, _isNew: true });
        },
        updateCategoryName(evt) {
            this.$store.commit('updateCategoryName', { id: this.category.id, name: evt.target.value });
        },
        removeCategory(category) {
            const callback = () => {
                this.$store.commit('removeCategory', category);
            };
            const speedbumpOptions = {
                body: 'Are you sure you want to delete this category? This cannot be undone.',
            };
            this.initSpeedbump(callback, speedbumpOptions);
        },
    },
};
</script>

<style lang="scss">
@import "../css/_globals";

.lpCategory {
    border: 2px solid transparent;
    list-style: none;
    margin: 0 0 26px;

    &.dropAccept {
        background: var(--lp-hover-bg);
    }

    &.dropHover {
        background: var(--lp-accent-green);
    }

    &.gu-mirror {
        background: var(--lp-content-bg);
        border: 1px solid var(--lp-border-strong);
    }
}

// Spreadsheet table: hairline dividers, fixed numeric columns, tabular
// numerals. Every row is a grid over one shared column template so the
// header subtotals, item cells, and footer can never drift out of sync:
// name | description | flags | (price) | weight | qty. The header merges
// the leading tracks; its tail matches the rows' fixed tracks exactly.
.lpItems {
    margin: 0;
    padding: 0;
    width: 100%;

    .lpItem,
    .lpItemsHeader,
    .lpItemsFooter {
        align-items: center;
        column-gap: 12px;
        display: grid;
        position: relative;
    }

    .lpItem {
        grid-template-columns: 180px minmax(0, 1fr) auto 72px 30px;
    }

    .lpItemsHeader {
        grid-template-columns: minmax(0, 1fr) 72px 30px;
    }

    .lpItemsFooter {
        grid-template-columns: 1fr;
    }

    &.lpHasPrice {
        .lpItem {
            grid-template-columns: 180px minmax(0, 1fr) auto 52px 72px 30px;
        }

        .lpItemsHeader {
            grid-template-columns: minmax(0, 1fr) 52px 72px 30px;
        }
    }

    &.lpHasImages .lpItem {
        grid-template-columns: 90px 180px minmax(0, 1fr) auto 72px 30px;
    }

    &.lpHasImages.lpHasPrice .lpItem {
        grid-template-columns: 90px 180px minmax(0, 1fr) auto 52px 72px 30px;
    }

    // Gutter controls live in the side margins so columns never shift.
    .lpHandleCell {
        left: -25px;
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        width: 16px;
    }

    // Sits further out in the gutter to leave clear space between the qty
    // stepper (which bleeds just past the table edge) and the remove ✕.
    .lpRemoveCell {
        position: absolute;
        right: -38px;
        top: 50%;
        transform: translateY(-50%);
    }

    .lpPriceCell {
        color: var(--lp-text-secondary);
        font-size: 13px;
        font-variant-numeric: tabular-nums;
        min-width: 0;
        text-align: right;
    }

    .lpWeightCell {
        font-variant-numeric: tabular-nums;
        min-width: 0;
        text-align: right;
        white-space: nowrap;
    }

    .lpQtyCell {
        font-size: 12px;
        min-width: 0;
        text-align: right;
    }
}

// The header's own rule *is* the category title's underline — there is no room
// for a second one 5px above it. So the title stays bare and hands its
// hover/focus state down to this border instead.
.lpItemsHeader {
    border-bottom: 1px solid var(--lp-border-strong);
    padding: 0 0 5px;
    transition: border-bottom-color $transitionDuration;

    &:has(input.lpCategoryName:hover) {
        border-bottom-color: var(--lp-border-hover);
    }

    &:has(input.lpCategoryName:focus) {
        border-bottom-color: var(--lp-accent-green-deep);
    }

    .lpCategoryHead {
        align-items: center;
        display: flex;
        gap: 8px;
        min-width: 0;
    }

    .lpCategorySwatch {
        flex: 0 0 11px;
        height: 11px;
    }

    // Quiet input base comes from .lpSilent; the rename affordance is the
    // header's border-bottom above, not an underline of its own.
    input.lpCategoryName {
        flex: 1 1 auto;
        font-size: 14.5px;
        font-weight: 700;
        min-width: 0;
        padding: 0 2px;
    }

    // padding-right mirrors the rows' unit-picker right padding; the unit's
    // padding-left mirrors their input-to-unit gap, so numbers and unit
    // labels line up column-exact with the item rows.
    .lpWeightCell {
        color: var(--lp-text);
        font-size: 13px;
        font-weight: 700;
        padding-right: 2px;

        .lpSubtotalUnit {
            color: var(--lp-text-secondary);
            font-size: 12px;
            font-weight: 400;
            padding-left: 6px;
        }

        .lpGhostCaret {
            visibility: hidden;
        }
    }

    // Item-row inputs inset their text 2px from the cell edge; match it.
    .lpPriceCell,
    .lpQtyCell {
        font-weight: 400;
        padding-right: 2px;
    }
}

.lpItemsFooter {
    padding: 7px 0;

    .lpAddItemCell {
        flex: 1 1 auto;
    }

    .lpAdd {
        font-size: 13px;
        font-weight: 600;
        margin: 0;
    }
}

// Hover-show rules for category drag handle and remove button
.lpCategory .lpHeader:hover .lpRemove,
.lpCategory .lpHeader:hover .lpHandle {
    visibility: visible;
}
</style>
