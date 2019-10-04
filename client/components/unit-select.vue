<style lang="scss">
@import "../css/_globals";

.lpUnitSelect {
    border: 1px solid transparent;
    cursor: pointer;
    display: inline-block;
    padding: 0 5px;
    position: relative;

    &:hover,
    &.lpHover {
        background: #fff;
        border: 1px solid $border1;

        i {
            opacity: 1;
        }
    }

    i {
        opacity: 0.6;
    }

    &.lpOpen {
        background: #fff;

        .lpUnitDropdown {
            display: block;
        }
    }

    .lpDisplay {
        display: inline-block;
        width: 1.1em;
    }

    .lpUnitDropdown {
        background: #fff;
        border: 1px solid #ccc;
        display: none;
        left: 0;
        padding: 0;
        position: absolute;
        top: -1px;
        z-index: $aboveSidebar+1;

        &.lb {
            top: -30px;
        }

        &.g {
            top: -55px;
        }

        &.kg {
            top: -81px;
        }

        li {
            list-style: none;
            padding: 2px 14px;

            &:hover {
                background: $blue1;
                color: #fff;
            }
        }
    }
}
</style>

<template>
    <div class="lpUnitSelect" :class="{lpOpen: isOpen, lpHover: isFocused}" @click="toggle($event)">
        <select class="lpUnit lpInvisible" :value="unit" @keyup="keyup($event)" @focus="focusSelect" @blur="blurSelect">
            <option v-for="unit in units" :value="unit">
                {{ unit }}
            </option>
        </select>
        <span class="lpDisplay">{{ unit }}</span>
        <i class="lpSprite lpExpand" />
        <ul :class="'lpUnitDropdown ' + unit">
            <li v-for="unit in units" :class="unit" @click="select(unit)">
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
        closeOnClick(evt) {
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
