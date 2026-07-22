<template>
    <span v-if="isSignedIn" id="settings" class="headerItem hasPopover">
        <PopoverHover>
            <template #target><span><i class="lpSprite lpSettings" /> Settings</span></template>
            <template #content><div>
                <div class="lpListSettingsScope">Display settings for this list</div>
                <ul id="lpOptionalFields">
                    <li v-for="optionalField in optionalFieldsLookup" :key="optionalField.name" class="lpOptionalField">
                        <toggle v-model="optionalField.value" @update:model-value="toggleOptionalField(optionalField.name)">
                            {{ optionalField.displayName }}
                        </toggle>
                    </li>
                </ul>
                <div v-if="optionalFields['price']" id="lpPriceSettings">
                    <hr>
                    <label>
                        Currency:
                        <input id="currencySymbol" type="text" maxlength="4" :value="library.currencySymbol" @input="updateCurrencySymbol($event)">
                    </label>
                </div>
            </div></template>
        </PopoverHover>
    </span>
</template>

<script>
import PopoverHover from './popover-hover.vue';
import toggle from './toggle.vue';

export default {
    name: 'ListSettings',
    components: {
        PopoverHover,
        toggle,
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
        optionalFields() {
            return this.$store.getters.optionalFields;
        },
        isSignedIn() {
            return this.$store.state.loggedIn;
        },
    },
    watch: {
        // Deep-watching the getter tracks both toggles on the active list
        // and switches to a different list (whose settings may differ).
        optionalFields: {
            handler() { this.updateOptionalFieldValues(); },
            deep: true,
        },
    },
    beforeMount() {
        this.updateOptionalFieldValues();
    },
    methods: {
        toggleOptionalField(optionalField) {
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
                fieldLookup.value = this.optionalFields[fieldLookup.name];
            }
        },
    },
};
</script>

<style lang="scss">

#csvUrl {
    display: block;
    margin-top: 15px;
}

#lpOptionalFields {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0;
    padding: 0;
}

.lpListSettingsScope {
    font-size: 12px;
    opacity: 0.7;
    margin-bottom: 6px;
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
