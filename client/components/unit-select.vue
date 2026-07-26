<template>
    <div class="lpUnitSelect" data-testid="unit-select" :class="{lpOpen: isOpen, lpHover: isFocused}" @click="toggle">
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
        // Deliberately lets the click keep bubbling: the window listener below
        // is what closes every other open picker, and stopping it here left
        // them all open at once.
        toggle() {
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
        // Any click that lands outside this picker closes it — including one on
        // another picker, which is how opening a second one dismisses the first.
        // The click that opened us reaches here too (the listener is bound
        // mid-dispatch, and window sits above us in the bubble path); the
        // containment test is what keeps that click from closing us again.
        // Clicks on our own options are left to toggle(), which closes us after
        // the option has been picked.
        closeOnClick(evt) {
            if (this.$el.contains(evt.target)) {
                return;
            }
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
