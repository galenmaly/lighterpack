<style lang="scss">

#csvUrl {
    display: block;
    margin-top: 15px;
}

#lpOptionalFields {
    margin: 0;
    padding: 0;
}

.lpOptionalField {
    list-style-type: none;
    margin: 0;
    padding: 0;
}

#lpPriceSettings {
    input {
        display: inline-block;
        margin-left: 10px;
        width: 50px;
    }
}

#share .lpContent {
    width: 330px;
}

#settings .lpContent {
    width: 200px;
}
</style>

<template>
    <span v-if="isSignedIn" id="settings" class="headerItem hasPopover">
        <PopoverHover>
            <span slot="target"><i class="lpSprite lpSettings" /> Settings</span>
            <div slot="content">
                <ul id="lpOptionalFields">
                    <li v-for="optionalField in optionalFieldsLookup" class="lpOptionalField" :key="optionalField.name">
                        <label>
                            <input v-model="optionalField.value" type="checkbox" @change="toggleOptionalField($event, optionalField.name)">
                            {{ optionalField.displayName }}
                        </label>
                    </li>
                </ul>
                <div v-if="library.optionalFields['price']" id="lpPriceSettings">
                    <hr>
                    <label>
                        Currency:
                        <input id="currencySymbol" type="text" maxlength="4" :value="library.currencySymbol" @input="updateCurrencySymbol($event)">
                    </label>
                </div>
            </div>
        </PopoverHover>
    </span>
</template>

<script>
import PopoverHover from './popover-hover.vue';

export default {
    name: 'ListSettings',
    components: {
        PopoverHover,
    },
    data() {
        return {
            optionalFieldsLookup: [{
                name: 'images',
                displayName: 'Item images',
                cssClass: 'lpShowImages',
                value: false,
            }, {
                name: 'price',
                displayName: 'Item prices',
                cssClass: 'lpShowPrices',
                value: false,
            }, {
                name: 'worn',
                displayName: 'Worn items',
                cssClass: 'lpShowWorn',
                value: false,
            }, {
                name: 'consumable',
                displayName: 'Consumable items',
                cssClass: 'lpShowConsumable',
                value: false,
            }, {
                name: 'listDescription',
                displayName: 'List descriptions',
                cssClass: 'lpShowListDescription',
                value: false,
            }],
        };
    },
    computed: {
        library() {
            return this.$store.state.library;
        },
        isSignedIn() {
            return this.$store.state.loggedIn;
        },
    },
    beforeMount() {
        this.updateOptionalFieldValues();
    },
    mounted() {
        bus.$on('optionalFieldChanged', () => {
            this.updateOptionalFieldValues();
        });
    },
    methods: {
        toggleOptionalField(evt, optionalField) {
            this.$store.commit('toggleOptionalField', optionalField);
        },
        updateCurrencySymbol(evt) {
            this.$store.commit('updateCurrencySymbol', evt.target.value);
        },
        updateOptionalFieldValues() {
            let i;
            let fieldLookup;

            for (i = 0; i < this.optionalFieldsLookup.length; i++) {
                fieldLookup = this.optionalFieldsLookup[i];
                fieldLookup.value = this.library.optionalFields[fieldLookup.name];
            }
        },
    },
};
</script>
