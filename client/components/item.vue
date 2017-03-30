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
        <input v-on:input="saveItem" type="text" v-model="item.name" class="lpName lpSilent" placeholder="Name" />
        <input v-on:input="saveItem" type="text" v-model="item.description" class="lpDescription lpSilent" placeholder="Description" />
        <span class="lpActionsCell">
            <i class="lpSprite lpCamera" title="Upload a photo or use a photo from the web"></i>
            <i v-on:click="updateItemLink" class="lpSprite lpLink" :class="{lpActive: item.url}" title="Add a link for this item"></i>
            <i v-if="library.optionalFields['worn']" v-on:click="toggleWorn" class="lpSprite lpWorn" :class="{lpActive: categoryItem.worn}" title="Mark this item as worn"></i>
            <i v-if="library.optionalFields['consumable']" v-on:click="toggleConsumable" class="lpSprite lpConsumable" :class="{lpActive: categoryItem.consumable}" title="Mark this item as a consumable"></i>
            <i :class="'lpSprite lpStar lpStar' + categoryItem.star" v-on:click="cycleStar" title="Star this item"></i>
        </span>
        <span v-if="library.optionalFields['price']" class="lpPriceCell">
            <input type="text" :value="item.price" class="lpPrice lpNumber lpSilent" />
        </span>
        <span class="lpWeightCell lpNumber">
            <input v-on:input="saveWeight" v-on:keydown.up="incrementWeight($event)" v-on:keydown.down="decrementWeight($event)"  type="text" v-model="weight" class="lpWeight lpNumber lpSilent" />
            <unitSelect :unit="item.authorUnit" :onChange="setUnit"></unitSelect>
        </span>
        <span class="lpQtyCell">
            <input v-on:input="saveCategoryItem" v-on:keydown.up="incrementQty($event)" v-on:keydown.down="decrementQty($event)" type="text" v-model="categoryItem.qty" class="lpQty lpNumber lpSilent" />
            <span class="lpArrows">
                <span class="lpSprite lpUp" v-on:click="incrementQty($event)"></span>
                <span class="lpSprite lpDown" v-on:click="decrementQty($event)"></span>
            </span>
        </span>
        <span class="lpRemoveCell">
            <a v-on:click="removeItem" class="lpRemove lpRemoveItem" title="Remove this item"><i class="lpSprite lpSpriteRemove"></i></a>
        </span>
    </li>
</template>

<script>
const utilsMixin = require("../mixins/utils-mixin.js");
const unitSelect = require("./unit-select.vue");
const weightUtils = require("../utils/weight.js");

module.exports = {
    name: "item",
    mixins: [utilsMixin],
    props: ["category", "itemContainer"],
    components: {
        unitSelect: unitSelect
    },
    data: function() {
        return {
            weight: 0,
            numStars: 4
        };
    },
    computed: {
        library: function() {
            return this.$store.state.library;
        },
        item() {
            return Vue.util.extend({}, this.itemContainer.item);
        },
        categoryItem() {
            return Vue.util.extend({}, this.itemContainer.categoryItem);
        }
    },
    methods: {
        saveItem: function() {
            this.item = this.$store.commit("updateItem", this.item);
        },
        saveCategoryItem: function() {
            this.categoryItem.qty = parseFloat(this.categoryItem.qty);
            this.$store.commit("updateCategoryItem", {category: this.category, categoryItem: this.categoryItem});
        },
        setUnit: function(unit) {
            this.item.authorUnit = unit;
            this.saveWeight(); //calling saveWeight preserves the text in the weight box instead of converting units.
        },
        setWeight: function() {
            this.weight = weightUtils.MgToWeight(this.item.weight, this.item.authorUnit);
        },
        saveWeight: function() {
            this.item.weight = weightUtils.WeightToMg(parseFloat(this.weight), this.item.authorUnit);
            this.saveItem();
        },
        updateItemLink: function() {
            bus.$emit("updateItemLink", this.item);
        },
        toggleWorn: function() {
            if (this.categoryItem.consumable) {
                return;
            }
            this.categoryItem.worn = !this.categoryItem.worn;
            this.saveCategoryItem();
        },
        toggleConsumable: function() {
            if (this.categoryItem.worn) {
                return;
            }
            this.categoryItem.consumable = !this.categoryItem.consumable;
            this.saveCategoryItem();
        },
        cycleStar: function() {
            if (!this.categoryItem.star) {
                this.categoryItem.star = 0;
            }
            this.categoryItem.star = (this.categoryItem.star + 1) % this.numStars;
            this.saveCategoryItem();
        },
        incrementQty: function(evt) {
            evt.stopImmediatePropagation();
            this.categoryItem.qty = parseFloat(this.categoryItem.qty) + 1;
            this.saveCategoryItem();
        },
        decrementQty: function(evt) {
            evt.stopImmediatePropagation();
            this.categoryItem.qty = parseFloat(this.categoryItem.qty) - 1;
            if (this.categoryItem.qty < 0) {
                this.categoryItem.qty = 0;
            }
            this.saveCategoryItem();
        },
        incrementWeight: function(evt) {
            evt.stopImmediatePropagation();
            this.weight = parseFloat(this.weight) + 1;
            this.saveWeight();
        },
        decrementWeight: function(evt) {
            evt.stopImmediatePropagation();
            this.weight = parseFloat(this.weight) - 1;
            this.saveWeight();
        },
        removeItem: function() {
            this.$store.commit("removeItemFromCategory", {itemId: this.item.id, category: this.category});
        },
    },
    watch: {
        item: function() {
            this.setWeight();
        }
    },
    beforeMount: function() {
        this.setWeight();
    }
}
</script>,