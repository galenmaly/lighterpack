<style lang="scss">
@import "../css/_globals";

.lpPopover {
    display: block;
    position: relative;
    .lpTarget {
        cursor: default;
        display: inline-block;
        position: relative;
        padding-bottom: 10px;
        margin-bottom: -10px;
    }

    .lpContent {
        background: #fff;
        box-shadow: 0 0 6px rgba(0, 0, 0, 0.25);
        color: $content;
        left: 50%;
        margin-top: 15px;
        min-width: 100%;
        opacity: 0;
        padding: 12px;
        pointer-events: none;
        position: absolute;
        top: 100%;
        transform: translateX(-50%);
        transition: all 0.15s;
        white-space: nowrap;
        z-index: $dialog;

        &::before {
            background-color: #fff;
            box-shadow: 0 0 6px rgba(0, 0, 0, 0.25);
            content: "";
            display: block;
            height: 20px;
            left: 50%;
            margin-left: -10px;
            position: absolute;
            top: -10px;
            transform: rotate(45deg);
            width: 20px;
            z-index: $dialog - 1;
        }

        &::after {
            background: #fff;
            content: "";
            display: block;
            height: 15px;
            left: 0;
            position: absolute;
            top: 0;
            width: 100%;
            z-index: $dialog + 1;
        }

        & > *:first-child {
            margin-top: 0;
        }

        & > *:last-child {
            margin-bottom: 0;
        }

        h3 {
            margin-bottom: 0;
        }

        ul {
            line-height: 25px;
        }

        hr {
            border-color: $border1;
            margin: 7px -0;
            padding: 0;
        }
    }

    &.lpPopoverShown {
        .lpTarget {
            z-index: $aboveDialog;
        }
        .lpContent {
            opacity: 1;
            pointer-events: all;
            margin-top: 10px;
        }
    }
}

</style>

<template>
    <div :class="{'lpPopover': true, 'lpPopoverShown': shown}" v-click-outside="hide">
        <div class="lpTarget">
            <slot name="target" />
        </div>
        <div class="lpContent">
            <slot name="content" />
        </div>
    </div>
</template>

<script>
export default {
    name: 'Popover',
    props: {
        id: {
            type: String,
            required: false,
        },
        shown: {
            type: Boolean,
            required: true,
        },
    },
    beforeMount() {
        this.bindEscape();
    },
    beforeDestroy() {
        this.unbindEscape();
    },
    methods: {
        hide() {
            this.$emit('hide');
        },
        bindEscape() {
            window.addEventListener('keyup', this.closeOnEscape);
        },
        unbindEscape() {
            window.removeEventListener('keyup', this.closeOnEscape);
        },
        closeOnEscape(evt) {
            if (this.shown && evt.keyCode === 27) {
                this.hide();
            }
        },
    },
};
</script>
