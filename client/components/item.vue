<style lang="scss">

</style>

<template>
    <li :class="'lpItem '+ item.classes" :id="item.id">
        <span class="lpHandleCell">
            <div class="lpItemHandle lpHandle" title="Reorder this item"></div>
        </span>
        <span v-if="library.optionalFields['images']" class="lpImageCell">
            <img v-on:click="viewItemImage()" v-if="thumbnailImage" class="lpItemImage" :src="thumbnailImage" />
        </span>
        <input v-on:input="saveItem" type="text" v-model="item.name" class="lpName lpSilent" placeholder="Name" />
        <input v-on:input="saveItem" type="text" v-model="item.description" class="lpDescription lpSilent" placeholder="Description" />
        <span class="lpActionsCell">
            <i v-on:click="updateItemImage" class="lpSprite lpCamera" title="Upload a photo or use a photo from the web"></i>
            <i v-on:click="updateItemLink" class="lpSprite lpLink" :class="{lpActive: item.url}" title="Add a link for this item"></i>
            <i v-if="library.optionalFields['worn']" v-on:click="toggleWorn" class="lpSprite lpWorn" :class="{lpActive: categoryItem.worn}" title="Mark this item as worn"></i>
            <i v-if="library.optionalFields['consumable']" v-on:click="toggleConsumable" class="lpSprite lpConsumable" :class="{lpActive: categoryItem.consumable}" title="Mark this item as a consumable"></i>
            <i :class="'lpSprite lpStar lpStar' + categoryItem.star" v-on:click="cycleStar" title="Star this item"></i>
        </span>
        <span v-if="library.optionalFields['price']" class="lpPriceCell">
            <input v-on:input="savePrice" type="text" v-model="displayPrice" v-on:keydown.up="incrementPrice($event)" v-on:keydown.down="decrementPrice($event)" :class="{lpPrice: true, lpNumber: true, lpSilent: true, lpSilentError: priceError}" v-on:blur="setDisplayPrice" v-empty-if-zero />
        </span>
        <span class="lpWeightCell lpNumber">
            <input v-on:input="saveWeight" v-on:keydown.up="incrementWeight($event)" v-on:keydown.down="decrementWeight($event)" type="text" v-model="displayWeight" :class="{lpWeight: true, lpNumber: true, lpSilent: true, lpSilentError: weightError}" v-empty-if-zero/>
            <unitSelect :unit="item.authorUnit" :onChange="setUnit"></unitSelect>
        </span>
        <span class="lpQtyCell">
            <input v-on:input="saveQty" v-on:keydown.up="incrementQty($event)" v-on:keydown.down="decrementQty($event)" type="text" v-model="displayQty" :class="{lpQty: true, lpNumber: true, lpSilent: true, lpSilentError: qtyError}" />
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
            displayWeight: 0,
            displayPrice: 0,
            displayQty: 0,
            weightError: false,
            priceError: false,
            qtyError: false,
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
        },
        thumbnailImage() {
            if (this.item.image) {
                return "https://i.imgur.com/" + this.item.image + "t.jpg";
            } else if (this.item.imageUrl) {
                return this.item.imageUrl;
            } else {
                return "";
            }
        },
        fullImage() {
            if (this.item.image) {
                return "https://i.imgur.com/" + this.item.image + "l.jpg";
            } else if (this.item.imageUrl) {
                return this.item.imageUrl;
            } else {
                return "";
            }
        },
    },
    methods: {
        saveItem: function() {
            this.item = this.$store.commit("updateItem", this.item);
        },
        saveCategoryItem: function() {           
            this.$store.commit("updateCategoryItem", {category: this.category, categoryItem: this.categoryItem});
        },
        setUnit: function(unit) {
            this.item.authorUnit = unit;
            this.saveWeight(); //calling saveWeight preserves the text in the weight box instead of converting units.
        },
        savePrice: function() {
            const priceFloat = parseFloat(this.displayPrice, 10);

            if (!isNaN(priceFloat)) {
                this.item.price = Math.round(priceFloat * 100) / 100;
                this.saveItem();
                this.priceError = false;
            } else {
                this.priceError = true;
            }
        },
        saveQty: function() {
            const qtyFloat = parseFloat(this.displayQty, 10);

            if (!isNaN(qtyFloat)) {
                this.categoryItem.qty = qtyFloat;
                this.saveCategoryItem();
                this.qtyError = false;
            } else {
                this.qtyError = true;
            }
        },
        saveWeight: function() {
            const weightFloat = parseFloat(this.displayWeight, 10);

            if (!isNaN(weightFloat)) {
                this.item.weight = weightUtils.WeightToMg(weightFloat, this.item.authorUnit);
                this.saveItem();
                this.weightError = false;
            } else {
                this.weightError = true;
            }
        },
        setDisplayPrice: function() {
            if (!this.priceError) {
                this.displayPrice = this.item.price.toFixed(2);
            }
        },
        setDisplayQty: function() {
            if (!this.qtyError) {
                this.displayQty = this.categoryItem.qty;
            }
        },
        setDisplayWeight: function() {
            this.displayWeight = weightUtils.MgToWeight(this.item.weight, this.item.authorUnit);
        },
        updateItemLink: function() {
            bus.$emit("updateItemLink", this.item);
        },
        updateItemImage: function() {
            bus.$emit("updateItemImage", this.item);
        },
        viewItemImage: function() {
            bus.$emit("viewItemImage", this.fullImage);
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
        incrementPrice: function(evt) {
            evt.stopImmediatePropagation();

            if (this.priceError) {
                return;
            }

            this.item.price = this.item.price + 1;

            this.saveItem();
            this.setDisplayPrice();
        },
        decrementPrice: function(evt) {
            evt.stopImmediatePropagation();

            if (this.priceError) {
                return;
            }

            this.item.price = this.item.price - 1;

            if (this.item.price < 0) {
                this.item.price = 0;
            }

            this.saveItem();
            this.setDisplayPrice();
        },
        incrementQty: function(evt) {
            evt.stopImmediatePropagation();

            if (this.qtyError) {
                return;
            }

            this.categoryItem.qty = this.categoryItem.qty + 1;
            this.saveCategoryItem();
        },
        decrementQty: function(evt) {
            evt.stopImmediatePropagation();

            if (this.qtyError) {
                return;
            }

            this.categoryItem.qty = this.categoryItem.qty - 1;

            if (this.categoryItem.qty < 0) {
                this.categoryItem.qty = 0;
            }

            this.saveCategoryItem();
        },
        incrementWeight: function(evt) {
            evt.stopImmediatePropagation();

            if (this.weightError) {
                return;
            }

            let newWeight = weightUtils.MgToWeight(this.item.weight, this.item.authorUnit) + 1;
            this.item.weight = weightUtils.WeightToMg(newWeight, this.item.authorUnit);

            this.saveItem();
        },
        decrementWeight: function(evt) {
            evt.stopImmediatePropagation();

            if (this.weightError) {
                return;
            }

            let newWeight = weightUtils.MgToWeight(this.item.weight, this.item.authorUnit) - 1;
            this.item.weight = weightUtils.WeightToMg(newWeight, this.item.authorUnit);

            if (this.item.weight < 0) {
                this.item.weight = 0;
            }

            this.saveItem();
        },
        removeItem: function() {
            this.$store.commit("removeItemFromCategory", {itemId: this.item.id, category: this.category});
        },
    },
    watch: {
        item: function() {
            this.setDisplayWeight();
        },
        categoryItem: function() {
            this.setDisplayQty();
        }
    },
    beforeMount: function() {
        this.setDisplayWeight();
        this.setDisplayPrice();
        this.setDisplayQty();
    }
}
</script>,