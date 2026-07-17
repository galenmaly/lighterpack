<template>
    <div class="lpListBody">
        <div v-if="isListNew" id="getStarted">
            <h2>Welcome to LighterPack!</h2>
            <p>Here's what you need to get started:</p>
            <ol>
                <li>Click on things to edit them. Give your list and category a name.</li>
                <li>Add new categories and give items weights to start the visualization.</li>
                <li v-if="!isLocalSaving">
                    When you're done, share your list with others!
                </li>
            </ol>
            <p v-if="isLocalSaving" class="lpWarning">
                <strong>Note:</strong> Your data is being saved to your local computer. In order to share your lists please register an account.
            </p>
        </div>
        <list-summary v-if="!isListNew" :list="list" />


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
import listDescription from './list-description.vue';
import listSummary from './list-summary.vue';

import dragula from 'dragula';
import { getElementIndex } from '../utils/utils.js';

export default {
    name: 'List',
    components: {
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
        isLocalSaving() {
            return this.$store.state.saveType === 'local';
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

#getStarted {
    background: var(--lp-get-started-bg);
    display: flex;
    flex-direction: column;
    height: 220px;
    justify-content: center;
    line-height: 1.6;
    margin-top: 22px;
    padding: $spacingLarge;

    h2 {
        font-size: 24px;
        line-height: 1;
    }

    h2,
    p,
    ol {
        margin: 0 0 $spacingMedium;

        &:last-child {
            margin-bottom: 0;
        }
    }
}

</style>
