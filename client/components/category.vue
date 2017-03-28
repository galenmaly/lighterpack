<style lang="scss">

</style>

<template>
    <li class="lpCategory" :id="category.id">
        <ul class="lpItems lpDataTable">
            <li class="lpHeader lpItemsHeader">
                <span class="lpHandleCell">
                    <div class="lpHandle lpCategoryHandle" title="Reorder this category"></div>
                </span>
                <input type="text" :value="category.name" placeholder="Category Name" class="lpCategoryName lpSilent"/>
                <span v-if="library.optionalFields['price']" class="lpPriceCell">Price</span>
                <span class="lpWeightCell">Weight</span>
                <span class="lpQtyCell">qty</span>
                <span class="lpRemoveCell"><a class="lpRemove lpRemoveCategory speedbump" title="Remove this category" data-speedbump="removeCategory"><i class="lpSprite lpSpriteRemove"></i></a></span>
            </li>
            <item v-for="itemContainer in itemContainers" :itemContainer="itemContainer"></item>
            <li class="lpFooter lpItemsFooter">
                <span class="lpAddItemCell">
                    <a class="lpAdd lpAddItem" v-on:click="newItem"><i class="lpSprite lpSpriteAdd"></i>Add new item</a>
                </span>
                <span v-if="library.optionalFields['price']" class="lpPriceCell lpNumber"><div class="lpPriceSubtotal"><span class="lpCurrencySymbol">{{library.currencySymbol}}</span><span class="lpDisplayPriceSubtotal">{{category.priceSubtotal}}</span></div></span>
                <span class="lpWeightCell lpNumber"><div class="lpSubtotal"><span class="lpDisplaySubtotal">{{category.displaySubtotal}}</span> <span class="lpSubtotalUnit">{{category.subtotalUnit}}</span></div></span>
                <span class="lpQtyCell"><div class="lpSubtotal"><span class="lpQtySubtotal">{{category.qtySubtotal}}</span></div></span>
                <span class="lpRemoveCell"></span>
            </li>
        </ul>
    </li>
</template>

<script>
const item = require("./item.vue");

module.exports = {
    name: "category",
    props: ["category"],
    components: {
        item: item
    },
    computed: {
        library() {
            return this.$store.state.library;
        },
        itemContainers() {
            return this.category.itemIds.map((categoryItem) => {
                return {categoryItem: categoryItem, item: this.library.getItemById(categoryItem.itemId)};
            });
        }
    },
    methods: {
        newItem() {
            this.$store.commit("newItem", this.category);
        }
    }
}
</script>