<style lang="scss">

.lpQtySubtotal {
    padding-right: 25px; /*Accommodates delete column */
}

.lpPriceSubtotal { /* unused? */
    padding-right: 4px;
}

</style>

<template>
    <li class="lpCategory" :id="category.id">
        <ul class="lpItems lpDataTable">
            <li class="lpHeader lpItemsHeader">
                <span class="lpHandleCell">
                    <div class="lpHandle lpCategoryHandle" title="Reorder this category"></div>
                </span>
                <input type="text" @input="updateCategoryName" :value="category.name" placeholder="Category Name" class="lpCategoryName lpSilent"/>
                <span v-if="library.optionalFields['price']" class="lpPriceCell">Price</span>
                <span class="lpWeightCell">Weight</span>
                <span class="lpQtyCell">qty</span>
                <span class="lpRemoveCell"><a @click="removeCategory(category)" class="lpRemove lpRemoveCategory" title="Remove this category"><i class="lpSprite lpSpriteRemove"></i></a></span>
            </li>
            <item v-for="itemContainer in itemContainers" :itemContainer="itemContainer" :category="category" :key="itemContainer.item.id"></item>
            <li class="lpFooter lpItemsFooter">
                <span class="lpAddItemCell">
                    <a class="lpAdd lpAddItem" @click="newItem"><i class="lpSprite lpSpriteAdd"></i>Add new item</a>
                </span>
                <span v-if="library.optionalFields['price']" class="lpPriceCell lpNumber lpSubtotal">
                    {{category.subtotalPrice | displayPrice(library.currencySymbol)}}
                </span>
                <span class="lpWeightCell lpNumber lpSubtotal">
                    <span class="lpDisplaySubtotal">{{category.subtotalWeight | displayWeight(library.totalUnit)}}</span>
                    <span class="lpSubtotalUnit">{{library.totalUnit}}</span>
                </span>
                <span class="lpQtyCell lpSubtotal">
                    <span class="lpQtySubtotal">{{category.subtotalQty}}</span>
                </span>
                <span class="lpRemoveCell"></span>
            </li>
        </ul>
    </li>
</template>

<script>
const utilsMixin = require("../mixins/utils-mixin.js");

import item from "./item.vue";

export default {
    name: "category",
    mixins: [utilsMixin],
    props: ["category"],
    components: {
        item: item
    },
    computed: {
        library() {
            return this.$store.state.library;
        },
        itemContainers() {
            return this.category.categoryItems.map((categoryItem) => {
                return {categoryItem: categoryItem, item: this.library.getItemById(categoryItem.itemId)};
            });
        }
    },
    methods: {
        newItem() {
            this.$store.commit("newItem", { category: this.category, _isNew: true });
        },
        updateCategoryName(evt) {
            this.$store.commit("updateCategoryName", {id: this.category.id, name: evt.target.value});
        },
        removeCategory(category) {
            var callback = function() {
                this.$store.commit("removeCategory", category);
            };
            var speedbumpOptions = {
                body: "Are you sure you want to delete this category? This cannot be undone."
            };
            bus.$emit("initSpeedbump", callback, speedbumpOptions);
        }
    }
}
</script>