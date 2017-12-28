<style lang="scss">

</style>

<template>
    <li class="lpCategory" :id="category.id">
        <ul class="lpItems lpDataTable">
            <li class="lpHeader lpItemsHeader">
                <span class="lpHandleCell">
                    <div class="lpHandle lpCategoryHandle" title="Reorder this category"></div>
                </span>
                <input type="text" v-on:input="updateCategoryName" :value="category.name" placeholder="Category Name" class="lpCategoryName lpSilent"/>
                <span v-if="library.optionalFields['price']" class="lpPriceCell">Price</span>
                <span class="lpWeightCell">Weight</span>
                <span class="lpQtyCell">qty</span>
                <span class="lpRemoveCell"><a v-on:click="removeCategory(category)" class="lpRemove lpRemoveCategory" title="Remove this category"><i class="lpSprite lpSpriteRemove"></i></a></span>
            </li>
            <item v-for="itemContainer in itemContainers" :itemContainer="itemContainer" :category="category" :key="itemContainer.item.id"></item>
            <li class="lpFooter lpItemsFooter">
                <span class="lpAddItemCell">
                    <a class="lpAdd lpAddItem" v-on:click="newItem"><i class="lpSprite lpSpriteAdd"></i>Add new item</a>
                </span>
                <span v-if="library.optionalFields['price']" class="lpPriceCell lpNumber"><div class="lpPriceSubtotal"><span class="lpCurrencySymbol">{{library.currencySymbol}}</span><span class="lpDisplayPriceSubtotal">{{category.priceSubtotal}}</span></div></span>
                <span class="lpWeightCell lpNumber"><div class="lpSubtotal"><span class="lpDisplaySubtotal">{{category.subtotal | displayWeight(library.totalUnit)}}</span> <span class="lpSubtotalUnit">{{library.totalUnit}}</span></div></span>
                <span class="lpQtyCell"><div class="lpSubtotal"><span class="lpQtySubtotal">{{category.qtySubtotal}}</span></div></span>
                <span class="lpRemoveCell"></span>
            </li>
        </ul>
    </li>
</template>

<script>
const item = require("./item.vue");
const utilsMixin = require("../mixins/utils-mixin.js");

module.exports = {
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
            this.$store.commit("newItem", this.category);
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