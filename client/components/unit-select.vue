<template>
    <div class="lpUnitSelect" data-testid="unit-select" :class="{lpOpen: isOpen, lpHover: isFocused}" @click="toggle($event)">
        <select class="lpUnit lpInvisible" :value="unit" @keyup="keyup($event)" @focus="focusSelect" @blur="blurSelect">
            <option v-for="unit in units" :key="unit" :value="unit">
                {{ unit }}
            </option>
        </select>
        <span class="lpDisplay">{{ unit }}</span>
        <i class="lpSprite lpExpand" />
        <ul :class="'lpUnitDropdown ' + unit">
            <li v-for="unit in units" :key="unit" :class="unit" @click="select(unit)">
                {{ unit }}
            </li>
        </ul>
    </div>
</template>

<script>
export default {
    name: 'UnitSelect',
    props: ['weight', 'unit', 'onChange'],
    data() {
        return {
            units: [
                'oz',
                'lb',
                'g',
                'kg',
            ],
            isOpen: false,
            isFocused: false,
        };
    },
    methods: {
        toggle(evt) {
            evt.stopPropagation();
            if (!this.isOpen) {
                this.open();
            } else {
                this.close();
            }
        },
        open() {
            this.isOpen = true;
            this.bindCloseListeners();
        },
        close() {
            this.isOpen = false;
            this.unbindCloseListeners();
        },
        select(unit) {
            if (typeof this.onChange === 'function') {
                this.onChange(unit);
            }
        },
        keyup(evt) {
            if (typeof this.onChange === 'function') {
                this.onChange(evt.target.value);
            }
        },
        bindCloseListeners() {
            window.addEventListener('keyup', this.closeOnEscape);
            window.addEventListener('click', this.closeOnClick);
        },
        unbindCloseListeners() {
            window.removeEventListener('keyup', this.closeOnEscape);
            window.removeEventListener('click', this.closeOnClick);
        },
        closeOnEscape(evt) {
            if (evt.keyCode === 27) {
                this.close();
            }
        },
        closeOnClick(_evt) {
            this.close();
        },
        focusSelect() {
            this.isFocused = true;
        },
        blurSelect() {
            this.isFocused = false;
        },
    },
};
</script>

<style lang="scss">
@import "../css/components/unit-select";
</style>
