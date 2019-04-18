<style lang="scss">
@import "../css/_globals";

#listDescriptionContainer {
    margin: 25px 0;

    h3,
    p {
        display: inline-block;
        margin: 0 0 5px;
    }

    h3 {
        margin-right: 10px;
    }

    textarea {
        height: 65px;
        width: 100%;
    }
}

#getStarted {
    background: $background1;
    font-size: 18px;
    height: 160px;
    padding: 30px 0;

    h2 {
        font-size: 30px;
    }
}

</style>

<template>
    <div class="lpListBody">
        <div v-if="isListNew" id="getStarted">
            <h2>Welcome to LighterPack!</h2>
            <p>Here's what you need to get started:</p>
            <ol>
                <li>Click on things to edit them. Give your list and category a name.</li>
                <li>Add new categories and items to your list.</li>
                <li>When you're done, share your list with others!</li>
            </ol>
        </div>
        <list-summary v-if="!isListNew" :list="list"></list-summary>
        

        <div style="clear: both;"></div>

        <div v-if="library.optionalFields['listDescription']" id="listDescriptionContainer">
            <h3>List Description</h3> <p>(<a href="https://guides.github.com/features/mastering-markdown/" target="_blank" class="lpHref">Markdown</a> supported)</p>
            <textarea id="listDescription" v-model="list.description" @input="updateListDescription"></textarea>
        </div>

        <ul class="lpCategories">
            <category v-for="category in categories" :category="category" :key="category.id"></category>
        </ul>

        <hr />

        <a @click="newCategory" class="lpAdd addCategory"><i class="lpSprite lpSpriteAdd"></i>Add new category</a>
    </div>
</template>

<script>
const dragula = require("dragula");

import category from "./category.vue";
import listSummary from "../components/list-summary.vue";

export default {
    name: "list",
    mixins: [],
    components: {
        listSummary: listSummary,
        category: category,
        categoryDragStartIndex: false,
        itemDragId: false,
    },
    data: function() {
        return {
            onboardingCompleted: false,
            itemDrake: null
        }
    },
    watch: {
        categories: function() {
            Vue.nextTick(() => {
                this.handleItemReorder();
            });
        }
    },
    computed: {
        library() {
            return this.$store.state.library;
        },
        list() {
            return this.library.getListById(this.library.defaultListId);
        },
        categories() {
            return this.list.categoryIds.map((id) => {
                return this.library.getCategoryById(id);
            });
        },
        isListNew() {
            if (this.list.total === 0) {
                return true;
            }
            return false;
        }
    },
    methods: {
        newCategory() {
            this.$store.commit("newCategory", this.list);
        },
        updateListDescription: function() {
            this.$store.commit("updateListDescription", this.list);
        },
        handleItemReorder() {
            if (this.itemDrake) {
                this.itemDrake.destroy();
            }
            var $categoryItems = Array.prototype.slice.call(document.getElementsByClassName("lpItems"));
            var drake = dragula($categoryItems, {
                moves: function ($el, $source, $handle, $sibling) {
                    return $handle.classList.contains("lpItemHandle");
                },
                accepts: function($el, $target, $source, $sibling) {
                    if (!$sibling || $sibling.classList.contains("lpItemsHeader")) {
                        return false; //header and footer are technically part of this list - exclude them both.
                    }
                    return true;
                }
            });
            drake.on("drag", ($el, $target, $source, $sibling) => {
                this.itemDragId = parseInt($el.id); //fragile
            });
            drake.on("drop", ($el, $target, $source, $sibling) => {
                var categoryId = parseInt($target.parentElement.id); //fragile
                this.$store.commit("reorderItem", {list: this.list, itemId: this.itemDragId, categoryId: categoryId, dropIndex: getElementIndex($el) - 1});
                drake.cancel(true);
            });
            this.itemDrake = drake;
        },
        handleCategoryReorder() {
            var $categories = document.getElementsByClassName("lpCategories")[0];
            var drake = dragula([$categories], {
                moves: function (el, $source, $handle, $sibling) {
                    return $handle.classList.contains("lpCategoryHandle");
                }
            });
            drake.on("drag", ($el, $target, $source, $sibling) => {
                this.categoryDragStartIndex = getElementIndex($el);
            });
            drake.on("drop", ($el, $target, $source, $sibling) => {
                this.$store.commit("reorderCategory", {list: this.list, before: this.categoryDragStartIndex, after: getElementIndex($el)});
                drake.cancel(true);
            });
        }
    },
    mounted: function() {
        this.handleCategoryReorder();
        this.handleItemReorder();
    }
}
</script>