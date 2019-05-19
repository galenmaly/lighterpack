<style lang="scss">
@import "../css/_globals";

</style>

<template>
    <Popover :shown="shown" @mouseover.native="show" @mouseout.native="startHideTimeout">
        <slot slot="target" name="target" />
        <slot slot="content" name="content" />
    </Popover>
</template>

<script>
import Popover from './popover.vue';

export default {
    name: 'PopoverHover',
    components: {
        Popover,
    },
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
            this.$emit("shown");
        },
        startHideTimeout() {
            this.hideTimeout = setTimeout(this.hide, 50);
        },
        hide() {
            this.shown = false;
            this.$emit("hidden");
        }
    },
};
</script>
