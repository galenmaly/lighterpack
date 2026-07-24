<template>
    <div v-click-outside="hide" :class="{'lpPopover': true, 'lpPopoverShown': shown}">
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
    emits: ['hide'],
    beforeMount() {
        this.bindEscape();
    },
    beforeUnmount() {
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

<style lang="scss">
@import "../css/_globals";

.lpPopover {
    display: block;
    position: relative;

    .lpTarget {
        cursor: default;
        display: inline-block;
        margin-bottom: -10px;
        padding-bottom: 10px;
        position: relative;
    }

    .lpContent {
        background: var(--lp-surface);
        // Three corners rounded; the call site squares off whichever corner
        // sits closest to the target, so the menu reads as growing out of it.
        border-radius: 10px;
        // Same lift as a dragged row — the menu floats above the page.
        box-shadow: var(--lp-lift-shadow);
        color: var(--lp-text);
        left: 50%;
        margin-top: 15px;
        min-width: 100%;
        opacity: 0;
        padding: 16px;
        pointer-events: none;
        position: absolute;
        top: 100%;
        transform: translateX(-50%);
        transition: all 0.15s;
        white-space: nowrap;
        z-index: $dialog;

        // Invisible bridge across the margin gap to the target: without it a
        // slow mouse move from target to menu crosses dead space and the
        // hover-triggered menu dismisses. pointer-events is inherited, so the
        // bridge is only live while the menu is shown (parent flips to `all`).
        &::before {
            content: "";
            height: 18px;
            left: 0;
            position: absolute;
            right: 0;
            top: -18px;
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

        ul, a {
            line-height: 25px;
        }

        hr {
            border-color: var(--lp-border-strong);
            margin: 7px -0;
            padding: 0;
        }
    }

    &.lpPopoverShown {
        .lpTarget {
            z-index: $aboveDialog;
        }

        .lpContent {
            margin-top: 10px;
            opacity: 1;
            pointer-events: all;
        }
    }
}

</style>
