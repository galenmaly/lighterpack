<style lang="scss">

</style>

<template>
    <div class="lpUnitSelect" :class="{lpOpen: isOpen, lpHover: isFocused}" v-on:click="toggle($event)">
        <select class="lpUnit lpInvisible" :value="unit" v-on:keyup="keyup($event)" v-on:focus='focusSelect' v-on:blur='blurSelect'>
            <option v-for="unit in units" :value="unit">{{unit}}</option>
        </select>
        <span class="lpDisplay">{{unit}}</span>
        <i class="lpSprite lpExpand"></i>
        <ul :class="'lpUnitDropdown ' + unit">
            <li v-for="unit in units" :class="unit" v-on:click="select(unit)">{{unit}}</li>
        </ul>
    </div>
</template>

<script>
export default {
    name: "unit-select",
    props: ["weight", "unit", "onChange"],
    data: function() {
        return {
            units: [
                "oz",
                "lb",
                "g",
                "kg"
            ],
            isOpen: false,
            isFocused: false
        };
    },
    methods: {
        toggle: function(evt) {
            evt.stopPropagation();
            if (!this.isOpen) {
                this.open();
            } else {
                this.close();
            }
        },
        open: function() {
            this.isOpen = true;
            this.bindCloseListeners();
        },
        close: function() {
            this.isOpen = false;
            this.unbindCloseListeners();
        },
        select: function(unit) {
            if (typeof this.onChange === "function") {
                this.onChange(unit);
            }
        },
        keyup: function(evt) {
            if (typeof this.onChange === "function") {
                this.onChange(evt.target.value);
            }
        },
        bindCloseListeners: function() {
            window.addEventListener('keyup', this.closeOnEscape);
            window.addEventListener('click', this.closeOnClick);
        },
        unbindCloseListeners: function() {
            window.removeEventListener('keyup', this.closeOnEscape);
            window.removeEventListener('click', this.closeOnClick);
        },
        closeOnEscape: function(evt) {
            if (evt.keyCode === 27) {
                this.close();
            }
        },
        closeOnClick: function(evt) {
            this.close();
        },
        focusSelect: function() {
            this.isFocused = true;
        },
        blurSelect: function() {
            this.isFocused = false;
        }
    }
}
</script>