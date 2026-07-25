import weightUtils from '../utils/weight.js';

const maxSharedListNames = 2;

// Everything an item row does, minus how it looks.
//
// Extracted verbatim from item.vue so the desktop row and the phone row
// (item-mobile.vue) share one implementation. The two differ only in markup:
// the desktop row is a grid of always-live inputs, the phone row is display
// text that swaps into an editor on tap. Neither owns the save/convert/toggle
// logic below.
//
// `rowFocused` means "this row is the one being edited" — on the desktop that
// is focus moving into one of its inputs, on a phone it's the tapped row's
// editor being open. The hint bubbles key off it either way.
export default {
    inject: ['openItemImage', 'openItemViewImage', 'openItemLink'],
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
            rowFocused: false,
        };
    },
    computed: {
        library() {
            return this.$store.state.library;
        },
        optionalFields() {
            return this.$store.getters.optionalFields;
        },
        item() {
            return Object.assign({}, this.itemContainer.item);
        },
        categoryItem() {
            return Object.assign({}, this.itemContainer.categoryItem);
        },
        thumbnailImage() {
            if (this.item.image) {
                return `https://i.imgur.com/${this.item.image}s.jpg`;
            } if (this.item.imageUrl) {
                // Locally hosted uploads have a _t thumbnail variant;
                // external URLs don't. (Mirrored in server/images.js.)
                if (this.item.imageUrl.indexOf('/userimages/') === 0) {
                    return this.item.imageUrl.replace(/\.webp$/, '_t.webp');
                }
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
        otherListsWithItem() {
            return this.library.getListsContainingItem(this.item.id)
                .filter((list) => list.id !== this.library.defaultListId);
        },
        sharedListNames() {
            return this.otherListsWithItem
                .slice(0, maxSharedListNames)
                .map((list) => list.name || 'New list');
        },
        sharedListMoreCount() {
            return Math.max(0, this.otherListsWithItem.length - maxSharedListNames);
        },
        showSharedBubble() {
            return this.rowFocused && this.otherListsWithItem.length > 0 && this.library.preferences.sharedItemBubble;
        },
        showWornQtyHint() {
            // Worn weight only counts one unit (see Category.calculateSubtotal),
            // so flag the surprise when a worn item has qty > 1. Gated on the
            // worn field being shown, since otherwise worn weight isn't computed.
            return this.rowFocused
                && this.optionalFields.worn
                && this.categoryItem.worn
                && this.categoryItem.qty > 1
                && this.library.preferences.wornQtyHint;
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
    mounted() {
        // _isNew exists only so v-focus-on-create focuses a freshly added row.
        // Clear it after that first mount, or every remount (e.g. switching
        // lists) steals focus back to this row.
        if (this.itemContainer.categoryItem._isNew) {
            this.$store.commit('updateCategoryItem', {
                category: this.category,
                categoryItem: Object.assign({}, this.itemContainer.categoryItem, { _isNew: false }),
            });
        }
    },
    methods: {
        saveItem() {
            this.$store.commit('updateItem', this.item);
        },
        saveCategoryItem() {
            this.$store.commit('updateCategoryItem', { category: this.category, categoryItem: this.categoryItem });
        },
        onRowFocusin() {
            this.rowFocused = true;
        },
        onRowFocusout(evt) {
            if (!evt.currentTarget.contains(evt.relatedTarget)) {
                this.rowFocused = false;
            }
        },
        forkItem() {
            // Remember which field is being edited so focus can survive the
            // row remounting under the forked item's id.
            const active = document.activeElement;
            const fieldClasses = ['lpName', 'lpDescription', 'lpPrice', 'lpWeight', 'lpQty'];
            const focusedField = (active && fieldClasses.find((cls) => active.classList.contains(cls))) || 'lpName';

            this.$store.commit('forkItem', { itemId: this.item.id, listId: this.library.defaultListId });

            const newItemId = this.itemContainer.categoryItem.itemId;
            this.$nextTick(() => {
                const row = document.getElementById(String(newItemId));
                const input = row && row.querySelector(`input.${focusedField}`);
                if (input) input.focus();
            });
        },
        dismissSharedBubble() {
            // The ✕ turns the hint off for good, not just for this row. A bubble
            // only renders while its preference is on, so a toggle reliably flips
            // it off — and the Account Settings checkbox can turn it back on.
            this.$store.commit('togglePreference', 'sharedItemBubble');
        },
        dismissWornQtyHint() {
            this.$store.commit('togglePreference', 'wornQtyHint');
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
            this.openItemLink(this.item);
        },
        updateItemImage() {
            this.openItemImage(this.item);
        },
        viewItemImage() {
            this.openItemViewImage(this.fullImage);
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
