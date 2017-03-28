<style lang="scss">

</style>

<template>
    <div class="lpUnitSelect" :class="{lpOpen: isOpen}" v-on:click="toggle">
        <span class="lpDisplay">{{unit}}</span>
        <i class="lpSprite lpExpand"></i>
        <ul class="lpUnitDropdown">
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
            isOpen: false
        };
    },
    methods: {
        toggle: function() {
            this.isOpen = !this.isOpen;
        },
        select: function(unit) {
            if (typeof this.onChange === "function") {
                this.onChange(unit);
            }
        }
    }
}
</script>