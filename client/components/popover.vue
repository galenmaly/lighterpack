<template>
    <div v-click-outside="hide" :class="{'lpPopover': true, 'lpPopoverShown': shown}">
        <!-- Phone only (display: none above the breakpoint). Without it the tap
             that dismisses the menu carries on into whatever is under it —
             usually an item row, which then opens its editor. Catching that tap
             also makes "anywhere else" a reliable way to close, which is what a
             menu on a touch screen needs since there's no hovering away. -->
        <!-- Teleported out to the body: the menu positions itself against the
             sticky header, which means this would otherwise be trapped in the
             header's stacking context and dim the header along with the page.
             Outside it, the scrim can sit under the app bar and over
             everything else. -->
        <Teleport to="body">
            <transition name="lpPopoverScrim">
                <div v-if="shown" class="lpPopoverScrim" data-testid="popover-scrim" @click.stop="hide" />
            </transition>
        </Teleport>
        <!-- The tap that opens the menu is caught here rather than on a wrapper
             around the whole popover: content and target share that wrapper, so
             taps on the controls inside an open menu were read as taps on the
             button that opens it. -->
        <div class="lpTarget" @click="$emit('target-tap')">
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
    emits: ['hide', 'target-tap'],
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

.lpPopoverScrim {
    display: none;
}

// A backstop for any popover that isn't given phone placement of its own (the
// header menus get theirs in dashboard.vue): stop it growing wider than the
// screen. Deliberately not touching white-space — these menus size themselves
// off their widest line, so letting them wrap collapsed the drawer's list menu
// to one word per line.
@media only screen and (width <= $mobile) {
    .lpPopover .lpContent {
        max-width: calc(100vw - 24px);
    }

    // Same dimming as the drawer, so an open menu reads as the same kind of
    // "tap anywhere to get out of this". Under the app bar ($mobileHeader), so
    // the header and the menu it carries stay lit while the page behind dims.
    .lpPopoverScrim {
        background: rgba(0, 0, 0, 0.35);
        display: block;
        inset: 0;
        position: fixed;
        z-index: $popoverScrim;
    }

    // Fades rather than snapping in, matching the drawer's scrim.
    .lpPopoverScrim-enter-active,
    .lpPopoverScrim-leave-active {
        transition: opacity $transitionDuration;
    }

    .lpPopoverScrim-enter-from,
    .lpPopoverScrim-leave-to {
        opacity: 0;
    }
}

</style>
