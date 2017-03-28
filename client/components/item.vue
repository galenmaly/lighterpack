<style lang="scss">

</style>

<template>
    <li :class="'lpItem '+ item.classes" :id="item.id">
        <span class="lpHandleCell">
            <div class="lpItemHandle lpHandle" title="Reorder this item"></div>
        </span>
        <span v-if="library.optionalFields['images']" class="lpImageCell">
            <img v-if="item.image" class="lpItemImage" :src="'https://i.imgur.com/' + item.image + 's.jpg'" />
            <img v-if="!item.image && item.imageUrl" class="lpItemImage" :src="item.imageUrl" />
        </span>
        <input v-on:change="saveItem" type="text" v-model="item.name" class="lpName lpSilent" placeholder="Name" />
        <input v-on:change="saveItem" type="text" v-model="item.description" class="lpDescription lpSilent" placeholder="Description" />
        <span class="lpActionsCell">
            <i class="lpSprite lpCamera" title="Upload a photo or use a photo from the web"></i>
            <i class="lpSprite lpLink" :class="{lpActive: item.url}" title="Add a link for this item"></i>
            <i v-if="library.optionalFields['worn']" class="lpSprite lpWorn" :class="{lpActive: categoryItem.worn}" title="Mark this item as worn"></i>
            <i v-if="library.optionalFields['consumable']" class="lpSprite lpConsumable" :class="{lpActive: categoryItem.consumable}" title="Mark this item as a consumable"></i>
            <i :class="'lpSprite lpStar ' + categoryItem.starClass"  title="Star this item"></i>
        </span>
        <span v-if="library.optionalFields['price']" class="lpPriceCell">
            <input type="text" :value="item.price" class="lpPrice lpNumber lpSilent" />
        </span>
        <span class="lpWeightCell lpNumber">
            <input v-on:change="saveItem" type="text" :value="item.weight | displayWeight(item.authorUnit)" class="lpWeight lpNumber lpSilent" />
            <unitSelect :unit="item.authorUnit" :onChange="setUnit"></unitSelect>
        </span>
        <span class="lpQtyCell">
            <input v-on:change="saveCategoryItem" type="text" v-model="categoryItem.qty" class="lpQty lpNumber lpSilent" />
            <span class="lpArrows">
                <span class="lpSprite lpUp"></span>
                <span class="lpSprite lpDown"></span>
            </span>
        </span>
        <span class="lpRemoveCell">
            <a class="lpRemove lpRemoveItem" title="Remove this item"><i class="lpSprite lpSpriteRemove"></i></a>
        </span>
    </li>
</template>

<script>
const utilsMixin = require("../mixins/utils-mixin.js");
const unitSelect = require("./unit-select.vue");

module.exports = {
    name: "item",
    mixins: [utilsMixin],
    props: ["category", "itemContainer"],
    components: {
        unitSelect: unitSelect
    },
    computed: {
        library: function() {
            return this.$store.state.library;
        },
        item() {
            return this.itemContainer.item;
        },
        categoryItem() {
            return this.itemContainer.categoryItem;
        }
    },
    methods: {
        saveItem: function() {
            this.$store.commit("updateItem", this.item);
        },
        saveCategoryItem: function() {
            this.$store.commit("updateCategoryItem", {category: this.category, categoryItem: this.categoryItem});
        },
        setUnit: function(unit) {
            this.item.authorUnit = unit;
            this.saveItem();
        }
    }
}
</script>,