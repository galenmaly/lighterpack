<template>
    <div @mouseenter="onPointerEnter" @mouseleave="onPointerLeave">
        <Popover :shown="shown" @hide="hide" @target-tap="toggleOnTap">
            <template #target>
                <slot name="target" />
            </template>
            <!-- Menus whose items act and then get out of the way close
                 themselves with this; the controls that hold state (toggles,
                 text boxes) leave it alone and the menu stays put. -->
            <template #content>
                <slot name="content" :hide="hide" />
            </template>
        </Popover>
    </div>
</template>

<script>
import Popover from './popover.vue';

export default {
    name: 'PopoverHover',
    components: {
        Popover,
    },
    emits: ['shown', 'hidden'],
    data() {
        return {
            shown: false,
            hideTimeout: null,
        };
    },
    methods: {
        show() {
            if (this.hideTimeout) {
                clearTimeout(this.hideTimeout);
                this.hideTimeout = null;
            }
            this.shown = true;
            this.$emit('shown');
        },
        hasHover() {
            return window.matchMedia('(hover: hover)').matches;
        },
        // Touch screens fire compatibility mouseenter/mouseleave after a tap.
        // Left alone, that opened the menu a beat before the tap handler ran,
        // which then saw an open menu and closed it again — so tapping did
        // nothing at all. Hover drives these only where hover exists.
        onPointerEnter() {
            if (this.hasHover()) {
                this.show();
            }
        },
        onPointerLeave() {
            if (this.hasHover()) {
                this.startHideTimeout();
            }
        },
        // Hover was the only way these menus ever opened, which left them
        // unreachable on a touch screen entirely.
        toggleOnTap() {
            if (this.hasHover()) {
                return;
            }
            if (this.shown) {
                this.hide();
            } else {
                this.show();
            }
        },
        startHideTimeout() {
            this.hideTimeout = setTimeout(this.hide, 50);
        },
        hide() {
            this.shown = false;
            this.$emit('hidden');
        },
    },
};
</script>

<style lang="scss">
@import "../css/_globals";

</style>
