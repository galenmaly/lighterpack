<style lang="scss">

.lpItem {
    &:hover,
    &.ui-sortable-helper {
        background: #fff;

        .lpRemove,
        .lpWorn,
        .lpConsumable,
        .lpCamera,
        .lpLink,
        .lpHandle,
        .lpArrows,
        .lpStar {
            visibility: visible;
        }
    }

    input,
    select {
        padding: 3px;
    }
}

.lpArrows {
    display: inline-block;
    height: 14px;
    position: relative;
    visibility: hidden;
    width: 10px;

    .lpUp,
    .lpDown {
        cursor: pointer;
        left: 0;
        margin: 2px;
        opacity: 0.5;
        position: absolute;
        top: 0;

        &:hover {
            opacity: 1;
        }
    }

    .lpDown {
        top: 11px;
    }
}

</style>

<template>
    <li :id="item.id" :class="'lpItem '+ item.classes">
        <span class="lpHandleCell">
            <div class="lpItemHandle lpHandle" title="Reorder this item" />
        </span>
        <span v-if="library.optionalFields['images']" class="lpImageCell">
            <img v-if="thumbnailImage" class="lpItemImage" :src="thumbnailImage" @click="viewItemImage()">
        </span>
        <input v-model="item.name" v-focus-on-create="categoryItem._isNew" type="text" class="lpName lpSilent" placeholder="Name" @input="saveItem">
        <input v-model="item.description" type="text" class="lpDescription lpSilent" placeholder="Description" @input="saveItem">
        <span class="lpActionsCell">
            <i class="lpSprite lpCamera" title="Upload a photo or use a photo from the web" @click="updateItemImage" />
            <i class="lpSprite lpLink" :class="{lpActive: item.url}" title="Add a link for this item" @click="updateItemLink" />
            <i v-if="library.optionalFields['worn']" class="lpSprite lpWorn" :class="{lpActive: categoryItem.worn}" title="Mark this item as worn" @click="toggleWorn" />
            <i v-if="library.optionalFields['consumable']" class="lpSprite lpConsumable" :class="{lpActive: categoryItem.consumable}" title="Mark this item as a consumable" @click="toggleConsumable" />
            <i :class="'lpSprite lpStar lpStar' + categoryItem.star" title="Star this item" @click="cycleStar" />
        </span>
        <span v-if="library.optionalFields['price']" class="lpPriceCell">
            <input v-model="displayPrice" v-empty-if-zero type="text" :class="{lpPrice: true, lpNumber: true, lpSilent: true, lpSilentError: priceError}" @input="savePrice" @keydown.up="incrementPrice($event)" @keydown.down="decrementPrice($event)" @blur="setDisplayPrice">
        </span>
        <span class="lpWeightCell lpNumber">
            <input v-model="displayWeight" v-empty-if-zero type="text" :class="{lpWeight: true, lpNumber: true, lpSilent: true, lpSilentError: weightError}" @input="saveWeight" @keydown.up="incrementWeight($event)" @keydown.down="decrementWeight($event)">
            <unitSelect :unit="item.authorUnit" :on-change="setUnit" />
        </span>
        <span class="lpQtyCell">
            <input v-model="displayQty" type="text" :class="{lpQty: true, lpNumber: true, lpSilent: true, lpSilentError: qtyError}" @input="saveQty" @keydown.up="incrementQty($event)" @keydown.down="decrementQty($event)">
            <span class="lpArrows">
                <span class="lpSprite lpUp" @click="incrementQty($event)" />
                <span class="lpSprite lpDown" @click="decrementQty($event)" />
            </span>
        </span>
        <span class="lpRemoveCell">
            <a class="lpRemove lpRemoveItem" title="Remove this item" @click="removeItem"><i class="lpSprite lpSpriteRemove" /></a>
        </span>
    </li>
</template>

<script>
import unitSelect from './unit-select.vue';

const utilsMixin = require('../mixins/utils-mixin.js');
const weightUtils = require('../utils/weight.js');

export default {
    name: 'Item',
    components: {
        unitSelect,
    },
    mixins: [utilsMixin],
    props: ['category', 'itemContainer'],
    data() {
        return {
            displayWeight: 0,
            displayPrice: 0,
            displayQty: 0,
            weightError: false,
            priceError: false,
            qtyError: false,
            numStars: 4,
        };
    },
    computed: {
        library() {
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
                return `https://i.imgur.com/${this.item.image}s.jpg`;
            } if (this.item.imageUrl) {
                return this.item.imageUrl;
            }
            return '';
        },
        fullImage() {
            if (this.item.image) {
                return `https://i.imgur.com/${this.item.image}l.jpg`;
            } if (this.item.imageUrl) {
                return this.item.imageUrl;
            }
            return '';
        },
    },
    watch: {
        item() {
            this.setDisplayWeight();
        },
        categoryItem() {
            this.setDisplayQty();
        },
    },
    beforeMount() {
        this.setDisplayWeight();
        this.setDisplayPrice();
        this.setDisplayQty();
    },
    methods: {
        saveItem() {
            this.$store.commit('updateItem', this.item);
        },
        saveCategoryItem() {
            this.$store.commit('updateCategoryItem', { category: this.category, categoryItem: this.categoryItem });
        },
        setUnit(unit) {
            this.item.authorUnit = unit;
            this.$store.commit('updateItemUnit', unit);
            this.saveWeight(); // calling saveWeight preserves the text in the weight box instead of converting units.
        },
        savePrice() {
            const priceFloat = parseFloat(this.displayPrice, 10);

            if (!isNaN(priceFloat)) {
                this.item.price = Math.round(priceFloat * 100) / 100;
                this.saveItem();
                this.priceError = false;
            } else {
                this.priceError = true;
            }
        },
        saveQty() {
            const qtyFloat = parseFloat(this.displayQty, 10);

            if (!isNaN(qtyFloat)) {
                this.categoryItem.qty = qtyFloat;
                this.saveCategoryItem();
                this.qtyError = false;
            } else {
                this.qtyError = true;
            }
        },
        saveWeight() {
            const weightFloat = parseFloat(this.displayWeight, 10);

            if (!isNaN(weightFloat)) {
                this.item.weight = weightUtils.WeightToMg(weightFloat, this.item.authorUnit);
                this.saveItem();
                this.weightError = false;
            } else {
                this.weightError = true;
            }
        },
        setDisplayPrice() {
            if (!this.priceError) {
                this.displayPrice = this.item.price.toFixed(2);
            }
        },
        setDisplayQty() {
            if (!this.qtyError) {
                this.displayQty = this.categoryItem.qty;
            }
        },
        setDisplayWeight() {
            this.displayWeight = weightUtils.MgToWeight(this.item.weight, this.item.authorUnit);
        },
        updateItemLink() {
            bus.$emit('updateItemLink', this.item);
        },
        updateItemImage() {
            bus.$emit('updateItemImage', this.item);
        },
        viewItemImage() {
            bus.$emit('viewItemImage', this.fullImage);
        },
        toggleWorn() {
            if (this.categoryItem.consumable) {
                return;
            }
            this.categoryItem.worn = !this.categoryItem.worn;
            this.saveCategoryItem();
        },
        toggleConsumable() {
            if (this.categoryItem.worn) {
                return;
            }
            this.categoryItem.consumable = !this.categoryItem.consumable;
            this.saveCategoryItem();
        },
        cycleStar() {
            if (!this.categoryItem.star) {
                this.categoryItem.star = 0;
            }
            this.categoryItem.star = (this.categoryItem.star + 1) % this.numStars;
            this.saveCategoryItem();
        },
        incrementPrice(evt) {
            evt.stopImmediatePropagation();

            if (this.priceError) {
                return;
            }

            this.item.price = this.item.price + 1;

            this.saveItem();
            this.setDisplayPrice();
        },
        decrementPrice(evt) {
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
        incrementQty(evt) {
            evt.stopImmediatePropagation();

            if (this.qtyError) {
                return;
            }

            this.categoryItem.qty = this.categoryItem.qty + 1;
            this.saveCategoryItem();
        },
        decrementQty(evt) {
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
        incrementWeight(evt) {
            evt.stopImmediatePropagation();

            if (this.weightError) {
                return;
            }

            const newWeight = weightUtils.MgToWeight(this.item.weight, this.item.authorUnit) + 1;
            this.item.weight = weightUtils.WeightToMg(newWeight, this.item.authorUnit);

            this.saveItem();
        },
        decrementWeight(evt) {
            evt.stopImmediatePropagation();

            if (this.weightError) {
                return;
            }

            const newWeight = weightUtils.MgToWeight(this.item.weight, this.item.authorUnit) - 1;
            this.item.weight = weightUtils.WeightToMg(newWeight, this.item.authorUnit);

            if (this.item.weight < 0) {
                this.item.weight = 0;
            }

            this.saveItem();
        },
        removeItem() {
            this.$store.commit('removeItemFromCategory', { itemId: this.item.id, category: this.category });
        },
    },
};
</script>,
