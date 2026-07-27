<template>
    <label class="lpToggle" :class="{ lpToggleDisabled: disabled }">
        <input
            v-bind="$attrs"
            type="checkbox"
            class="lpToggleControl"
            :checked="modelValue"
            :disabled="disabled"
            @change="$emit('update:modelValue', $event.target.checked)"
        >
        <span v-if="$slots.default" class="lpToggleText"><slot /></span>
    </label>
</template>

<script>
export default {
    name: 'Toggle',
    // Attributes land on the checkbox itself, not the wrapping label, so
    // data-testid and aria-* keep pointing at the thing that holds state.
    inheritAttrs: false,
    props: {
        modelValue: {
            type: Boolean,
            default: false,
        },
        disabled: {
            type: Boolean,
            default: false,
        },
    },
    emits: ['update:modelValue'],
};
</script>

<style lang="scss">
// Presentation lives in a partial so the share page can reuse the switch;
// see client/css/components/_toggle.scss.
@import "../css/components/toggle";
</style>
