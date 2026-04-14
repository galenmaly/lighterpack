<template>
    <li :id="category.id" class="lpCategory" data-testid="category">
        <ul class="lpItems lpDataTable">
            <li class="lpHeader lpItemsHeader">
                <span class="lpHandleCell">
                    <div class="lpHandle lpCategoryHandle" title="Reorder this category" />
                </span>
                <input v-focus-on-create="category._isNew" type="text" :value="category.name" placeholder="Category Name" class="lpCategoryName lpSilent" @input="updateCategoryName">
                <span v-if="library.optionalFields['price']" class="lpPriceCell">Price</span>
                <span class="lpWeightCell">Weight</span>
                <span class="lpQtyCell">qty</span>
                <span class="lpRemoveCell"><a class="lpRemove lpRemoveCategory" title="Remove this category" @click="removeCategory(category)"><i class="lpSprite lpSpriteRemove" /></a></span>
            </li>
            <item v-for="itemContainer in itemContainers" :key="itemContainer.item.id" :item-container="itemContainer" :category="category" />
            <li class="lpFooter lpItemsFooter">
                <span class="lpAddItemCell">
                    <a class="lpAdd lpAddItem" @click="newItem"><i class="lpSprite lpSpriteAdd" />Add new item</a>
                </span>
                <span v-if="library.optionalFields['price']" class="lpPriceCell lpNumber lpSubtotal">
                    {{ displayPrice(category.subtotalPrice, library.currencySymbol) }}
                </span>
                <span class="lpWeightCell lpNumber lpSubtotal">
                    <span class="lpDisplaySubtotal" data-testid="category-subtotal-weight">{{ displayWeight(category.subtotalWeight, library.totalUnit) }}</span>
                    <span class="lpSubtotalUnit">{{ library.totalUnit }}</span>
                </span>
                <span class="lpQtyCell lpSubtotal">
                    <span class="lpQtySubtotal">{{ category.subtotalQty }}</span>
                </span>
                <span class="lpRemoveCell" />
            </li>
        </ul>
    </li>
</template>

<script>
import item from './item.vue';

import utilsMixin from '../mixins/utils-mixin.js';

export default {
    name: 'Category',
    components: {
        item,
    },
    mixins: [utilsMixin],
    inject: ['initSpeedbump'],
    props: ['category'],
    computed: {
        library() {
            return this.$store.state.library;
        },
        itemContainers() {
            return this.category.categoryItems.map(categoryItem => ({ categoryItem, item: this.library.getItemById(categoryItem.itemId) }));
        },
    },
    methods: {
        newItem() {
            this.$store.commit('newItem', { category: this.category, _isNew: true });
        },
        updateCategoryName(evt) {
            this.$store.commit('updateCategoryName', { id: this.category.id, name: evt.target.value });
        },
        removeCategory(category) {
            const callback = () => {
                this.$store.commit('removeCategory', category);
            };
            const speedbumpOptions = {
                body: 'Are you sure you want to delete this category? This cannot be undone.',
            };
            this.initSpeedbump(callback, speedbumpOptions);
        },
    },
};
</script>

<style lang="scss">

.lpQtySubtotal {
    padding-right: 25px; /* Accommodates delete column */
}

.lpPriceSubtotal { /* unused? */
    padding-right: 4px;
}

</style>
