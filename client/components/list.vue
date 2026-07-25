<template>
    <div class="lpListBody">
        <get-started v-if="isListNew" />
        <list-summary v-else :list="list" />


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

import dragula from 'dragula';
import { getElementIndex } from '../utils/utils.js';

export default {
    name: 'List',
    components: {
        getStarted,
        listSummary,
        listDescription,
        category,
    },
    data() {
        return {
            itemDrake: null,
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
    },
    watch: {
        categories() {
            this.$nextTick(() => {
                this.handleItemReorder();
            });
        },
    },
    mounted() {
        this.handleCategoryReorder();
        this.handleItemReorder();
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

</style>
