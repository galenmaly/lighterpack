<template>
    <span class="lpColorPickerWrapper">
        <span class="lpLegend" :style="{'background-color': color}" />
        <input class="lpColorInput" type="color" :value="color" @input="onColorChange($event.target.value)">
    </span>
</template>

<script>
export default {
    name: 'ColorPicker',
    props: ['color'],
    emits: ['colorChange'],
    methods: {
        onColorChange(newColor) {
            this.$emit('colorChange', newColor);
        },
    },
};
</script>

<style lang="scss">
.lpColorPickerWrapper {
    display: inline-block;
    position: relative;
}

.lpLegend {
    cursor: pointer;
    display: inline-block;
}

.lpColorInput {
    cursor: pointer;
    height: 100%;
    left: 0;
    opacity: 0;
    position: absolute;
    top: 0;
    width: 100%;
}
</style>
