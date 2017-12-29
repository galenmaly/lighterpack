<style lang="scss">
</style>

<template>
    <section id="libraryContainer">
        <h2>Gear</h2>
        <div>
            <input type="checkbox" id="libraryActiveFilter" name="libraryActiveFilter" v-on:change="toggleActiveFilter"/>
            <label for="libraryActiveFilter">Include Active Items</label>
        </div>
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
                <a v-on:click="removeItem(item)" class="lpRemove lpRemoveLibraryItem speedbump" title="Delete this item permanently"><i class="lpSprite lpSpriteRemove"></i></a>
                <div class="lpHandle lpLibraryItemHandle" title="Reorder this item" v-if="!item.inCurrentList"></div>
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
            itemDragId: false,
            drake: null,
            isActiveFiltered: true
        };
    },
    watch: {
        categories: function() {
            Vue.nextTick(() => {
                this.handleItemDrag();
            });
        }
    },
    computed: {
        library() {
            return this.$store.state.library;
        },
        filteredItems() {
            var i,
                item,
                filteredItems = [];
            if (!this.searchText) {
                filteredItems = this.library.items.map((item) => { return Vue.util.extend({}, item); });
            } else {
                for (i = 0; i < this.library.items.length; i++) {
                    item = this.library.items[i];
                    if (item.name.toLowerCase().indexOf(this.searchText) > -1 || item.description.toLowerCase().indexOf(this.searchText) > -1 ) {
                        filteredItems.push(Vue.util.extend({}, item));
                    }
                }
            }

            var currentListItems = this.library.getItemsInCurrentList();
            
            var i = filteredItems.length;
            while (i--) {
                item = filteredItems[i];
                if (currentListItems.indexOf(item.id) > -1) {
                    if (this.isActiveFiltered) {
                        filteredItems.splice(i,1);
                    } else {
                        item.inCurrentList = true;
                    }
                }
            }

            return filteredItems;
        },
        list() {
            return this.library.getListById(this.library.defaultListId);
        },
        categories() {
            return this.list.categoryIds.map((id) => {
                return this.library.getCategoryById(id);
            });
        },
    },
    methods: {
        handleItemDrag() {
            if (this.drake) {
                this.drake.destroy();
            }

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
            this.drake = drake;
        },
        removeItem(item) {
            var callback = function() {
                this.$store.commit("removeItem", item);
            };
            var speedbumpOptions = {
                body: "Are you sure you want to delete this item? This cannot be undone."
            };
            bus.$emit("initSpeedbump", callback, speedbumpOptions);
        },
        toggleActiveFilter() {
            if (document.getElementById("libraryActiveFilter").checked) {
                this.isActiveFiltered = false;
            } else {
                this.isActiveFiltered = true;
            }
        }
    },
    mounted: function() {
        this.handleItemDrag();
    }
}
</script>