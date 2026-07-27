<template>
    <div class="lpListBody" :class="{ lpDensityCompact: isCompact }">
        <get-started v-if="isListNew" />
        <component :is="summaryComponent" v-else :list="list" />


        <div style="clear: both;" />

        <list-description v-if="list.optionalFields['listDescription']" :list="list" />

        <ul class="lpCategories">
            <category v-for="category in categories" :key="category.id" :category="category" />
        </ul>

        <a class="lpAdd addCategory" @click="newCategory"><i class="lpSprite lpSpriteAdd" />Add new category</a>
    </div>
</template>

<script>
import category from './category.vue';
import getStarted from './get-started.vue';
import listDescription from './list-description.vue';
import listSummary from './list-summary.vue';
import listSummaryMobile from './list-summary-mobile.vue';

import dragula from 'dragula';
import { getElementIndex } from '../utils/utils.js';
import { createTouchReorder } from '../utils/touch-reorder.js';
import { isMobile } from '../utils/viewport.js';

export default {
    name: 'List',
    components: {
        getStarted,
        listSummary,
        listSummaryMobile,
        listDescription,
        category,
    },
    setup() {
        return { isMobile };
    },
    data() {
        return {
            itemDrake: null,
            itemTouchReorder: null,
            categoryDragStartIndex: null,
            itemDragId: null,
        };
    },
    computed: {
        library() {
            return this.$store.state.library;
        },
        list() {
            return this.$store.getters.activeList;
        },
        categories() {
            return this.list.categoryIds.map(id => this.library.getCategoryById(id));
        },
        isListNew() {
            return this.list.totalWeight === 0;
        },
        // Set in the Settings menu. Only the edit page honours it — the share
        // page is rendered server-side from the same data.
        isCompact() {
            return this.library.preferences.density === 'compact';
        },
        // The collapsed scoreboard strip has no desktop counterpart, so the
        // summary swaps components rather than reflowing. See
        // list-summary-mobile.vue.
        summaryComponent() {
            return this.isMobile ? 'listSummaryMobile' : 'listSummary';
        },
    },
    watch: {
        categories() {
            this.$nextTick(() => {
                this.handleItemReorder();
            });
        },
        // Crossing the breakpoint swaps the row component, so the gesture has
        // to swap too. No categories watcher equivalent: the touch path
        // delegates from the document, so re-rendered rows need no re-binding.
        isMobile: {
            immediate: true,
            handler(mobile) {
                if (mobile) {
                    this.handleMobileItemReorder();
                } else if (this.itemTouchReorder) {
                    this.itemTouchReorder.destroy();
                    this.itemTouchReorder = null;
                }
            },
        },
    },
    mounted() {
        this.handleCategoryReorder();
        this.handleItemReorder();
    },
    beforeUnmount() {
        if (this.itemTouchReorder) {
            this.itemTouchReorder.destroy();
            this.itemTouchReorder = null;
        }
    },
    methods: {
        newCategory() {
            this.$store.commit('newCategory', this.list);
        },
        handleItemReorder() {
            if (this.itemDrake) {
                this.itemDrake.destroy();
            }
            const $categoryItems = Array.prototype.slice.call(document.getElementsByClassName('lpItems'));
            const drake = dragula($categoryItems, {
                // Park the drag mirror inside a list instead of dragula's
                // default <body>, so the .lpItems-scoped row styles (grid
                // template, gutter cells) still match the clone — on <body> it
                // falls back to bare .lpItem and collapses. Any list will do:
                // the grid template varies with the list's optional fields,
                // which are shared by every category in the list.
                mirrorContainer: $categoryItems[0],
                moves($el, $source, $handle, _$sibling) {
                    return $handle.classList.contains('lpItemHandle');
                },
                accepts($el, $target, $source, $sibling) {
                    if (!$sibling || $sibling.classList.contains('lpItemsHeader')) {
                        return false; // header and footer are technically part of this list - exclude them both.
                    }
                    return true;
                },
            });
            drake.on('drag', ($el, _$target, _$source, _$sibling) => {
                this.itemDragId = parseInt($el.id); // fragile
            });
            drake.on('drop', ($el, $target, _$source, _$sibling) => {
                const categoryId = parseInt($target.parentElement.id); // fragile
                this.$store.commit('reorderItem', {
                    list: this.list, itemId: this.itemDragId, categoryId, dropIndex: getElementIndex($el) - 1,
                });
                drake.cancel(true);
            });
            this.itemDrake = drake;
        },
        // The phone's counterpart to handleItemReorder: same containers,
        // mutation and drop-index arithmetic, only the gesture differs.
        handleMobileItemReorder() {
            if (this.itemTouchReorder) {
                this.itemTouchReorder.destroy();
            }
            this.itemTouchReorder = createTouchReorder({
                containers: () => Array.prototype.slice.call(document.getElementsByClassName('lpItems')),
                itemSelector: '.lpItemMobile',
                // Never after the footer — the desktop's accepts() exclusion.
                endSelector: '.lpItemsFooter',
                // A slow tap on a control is aiming at that control, not at
                // lifting the row it sits in.
                ignoreSelector: 'a, button, input, textarea, select',
                // An open editor is a form, not a row to be shuffled.
                canStart: $el => !$el.classList.contains('lpItemMobileEditing'),
                onDrop: ({ el, toContainer }) => {
                    const categoryId = parseInt(toContainer.parentElement.id); // fragile
                    this.$store.commit('reorderItem', {
                        list: this.list, itemId: parseInt(el.id), categoryId, dropIndex: getElementIndex(el) - 1,
                    });
                },
            });
        },
        handleCategoryReorder() {
            const $categories = document.getElementsByClassName('lpCategories')[0];
            const drake = dragula([$categories], {
                moves(_el, _$source, $handle, _$sibling) {
                    return $handle.classList.contains('lpCategoryHandle');
                },
            });
            drake.on('drag', ($el, _$target, _$source, _$sibling) => {
                this.categoryDragStartIndex = getElementIndex($el);
            });
            drake.on('drop', ($el, _$target, _$source, _$sibling) => {
                this.$store.commit('reorderCategory', { list: this.list, before: this.categoryDragStartIndex, after: getElementIndex($el) });
                drake.cancel(true);
            });
        },
    },
};
</script>

<style lang="scss">
@import "../css/_globals";

// The 56px side padding forms the gutters that row controls bleed into.
.lpListBody {
    flex: 0 0 auto;
    padding: 0 56px;
}

.lpCategories {
    margin: 0;
    padding: 0;
}

.lpListBody .addCategory {
    font-size: 13px;
    font-weight: 600;
    margin: 0 0 20px;
}

// ============================================================
// Phone layout (#11a/#18a)
//
// The 56px gutters exist so desktop row controls (drag handle, remove ✕) can
// bleed into the margins. There's no room for gutters at this width and no
// hover to reveal them, so the body goes edge to edge and the rows carry
// their own 14px inset — which lets the hairline dividers run full bleed,
// as the design draws them.
// ============================================================
@media only screen and (width <= $mobile) {
    .lpListBody {
        padding: 0;
    }

    .lpListBody .addCategory {
        margin: 0;
        padding: 14px;
    }
}

</style>
