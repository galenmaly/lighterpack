<style lang="scss">

</style>

<template>
    <span v-if="isSignedIn" id="settings" class="headerItem hasFlyout">
        <span class="lpFlyout">
            <span class="lpTarget"><i class="lpSprite lpSettings"></i> Settings</span>
            <div class="lpContent">
                <ul id="lpOptionalFields">
                    <li v-for="optionalField in optionalFieldsLookup" class="lpOptionalField">
                        <label>
                            <input type="checkbox" v-model="optionalField.value" v-on:change="toggleOptionalField($event, optionalField.name)"/>
                            {{optionalField.displayName}}
                        </label>
                    </li>
                </ul>
                <div id="lpPriceSettings" v-if="library.optionalFields['price']">
                    <hr />
                    <label>
                        Currency:
                        <input id="currencySymbol" type="text" maxlength="4" :value="library.currencySymbol" v-on:input="updateCurrencySymbol($event)"/>
                    </label>
                </div>
            </div>
        </span>
    </span>
</template>

<script>

module.exports = {
    name: "header",
    mixins: [],
    data: function() {
        return {
            optionalFieldsLookup: [{
                name: "images",
                displayName: "Item images",
                cssClass: "lpShowImages"
            }, {
                name: "price",
                displayName: "Item prices",
                cssClass: "lpShowPrices"
            }, {
                name: "worn",
                displayName: "Worn items",
                cssClass: "lpShowWorn"
            }, {
                name: "consumable",
                displayName: "Consumable items",
                cssClass: "lpShowConsumable"
            }, {
                name: "listDescription",
                displayName: "List descriptions",
                cssClass: "lpShowListDescription"
            }]
        }
    },
    computed: {
        library: function() {
            return this.$store.state.library;
        },
        isSignedIn: function() {
            return this.$store.state.loggedIn;
        }
    },
    methods: {
        toggleOptionalField: function(evt, optionalField) {
            this.$store.commit("toggleOptionalField", optionalField);
        },
        updateCurrencySymbol: function(evt) {
            this.$store.commit("updateCurrencySymbol", evt.target.value);
        },
        updateOptionalFieldValues: function() {
            var i,
            fieldLookup;

            for (i = 0; i < this.optionalFieldsLookup.length; i++) {
                fieldLookup = this.optionalFieldsLookup[i];
                fieldLookup.value = this.library.optionalFields[fieldLookup.name];
            }
        }
    },
    beforeMount: function() {
        this.updateOptionalFieldValues();
    }
}
</script>
