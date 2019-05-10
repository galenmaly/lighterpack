<style lang="scss">

</style>

<template>
    <Popover id="lpPickerContainer" :shown="shown" @hide="shown = false">
        <span slot="target" class="lpLegend" :style="{'background-color': color}" @click="shown = true" />
        <VueColorPicker slot="content" :width="150" :height="150" :disabled="false" :startColor="color" @color-change="onColorChange" />
    </Popover>
</template>

<script>
import VueColorPicker from 'vue-color-picker-wheel';
import Popover from './popover.vue';

export default {
    name: 'ColorPicker',
    components: {
        VueColorPicker,
        Popover,
    },
    props: [
        "color"
    ],
    data() {
        return {
            shown: false,
        };
    },
    methods: {
        onColorChange(newColor) {
            this.$emit("colorChange", newColor);
        },
    },
};

</script>
