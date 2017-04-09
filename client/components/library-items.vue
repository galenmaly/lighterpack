<style lang="scss">
</style>

<template>
    <section id="libraryContainer">
        <h2>Gear</h2>
        <input type="text" id="librarySearch" placeholder="search items" v-model="searchText"/>
        <ul id="library">
            <li v-for="item in filteredItems" class="lpLibraryItem" :data-item-id="item.id">
                <a v-if="item.url" :href="item.url" target="_blank" class="lpName lpHref">{{item.name}}</a>
                <span v-if="!item.url" class="lpName">{{item.name}}</span>
                <span class="lpWeight">
                    {{item.weight | displayWeight(item.authorUnit) }}
                    {{item.authorUnit}}
                </span>
                <span class="lpDescription">
                    {{item.description}}
                </span>
                <a class="lpRemove lpRemoveLibraryItem speedbump" title="Delete this item permanently" data-speedbump="removeItem"><i class="lpSprite lpSpriteRemove"></i></a>
                <div class="lpHandle lpLibraryItemHandle" title="Reorder this item"></div>
            </li>
        </ul>
    </section>
</template>

<script>
const dragula = require("dragula");
import utilsMixin from "../mixins/utils-mixin.js";

export default {
    name: "libraryItem",
    mixins: [utilsMixin],
    props: ["item"],
    data: function() {
        return {
            searchText: "",
            itemDragId: false
        };
    },
    computed: {
        library() {
            return this.$store.state.library;
        },
        filteredItems() {
            if (!this.searchText) {
                return this.library.items;
            } else {
                var filteredItems = [];
                for (var i in this.library.items) {
                    var item = this.library.items[i];
                    if (item.name.toLowerCase().indexOf(this.searchText) > -1 || item.description.toLowerCase().indexOf(this.searchText) > -1 ) {
                        filteredItems.push(item);
                    }
                }
                return filteredItems;
            }
        }
    },
    methods: {
        handleItemDrag() {
            var self = this;
            var $library = document.getElementById("library");
            var $categoryItems = Array.prototype.slice.call(document.getElementsByClassName("lpItems")); //list.vue
            var drake = dragula([$library].concat($categoryItems), {
                copy: true,
                moves: function ($el, $source, $handle, $sibling) {
                    var items = self.library.getItemsInCurrentList();
                    if (items.indexOf(parseInt($el.dataset.itemId)) > -1) {
                        return false;
                    }
                    return $handle.classList.contains("lpLibraryItemHandle");
                },
                accepts: function($el, $target, $source, $sibling) {
                    if ($target.id === "library" || !$sibling || $sibling.classList.contains("lpItemsHeader")) {
                        return false; //header and footer are technically part of this list - exclude them both.
                    }
                    return true;
                }
            });
            drake.on("drag", ($el, $target, $source, $sibling) => {
                this.itemDragId = parseInt($el.dataset.itemId); //fragile
            });
            drake.on("drop", ($el, $target, $source, $sibling) => {
                if (!$target || $target.id === "library") {
                    return;
                }
                var categoryId = parseInt($target.parentElement.id); //fragile
                this.$store.commit("addItemToCategory", {itemId: this.itemDragId, categoryId: categoryId, dropIndex: getElementIndex($el) - 1});
                drake.cancel(true);
            });
        }
    },
    mounted: function() {
        this.handleItemDrag();
    }
}
</script>