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
@import "../css/_globals";

.lpToggle {
    align-items: center;
    cursor: pointer;
    display: flex;
    gap: 8px;
}

/* A real checkbox wearing a switch: appearance:none lets us paint the track
   and thumb while keeping native checked state, label association, keyboard
   support and form semantics. */
.lpToggleControl {
    appearance: none;
    -webkit-appearance: none;
    background: var(--lp-icon-rest);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    flex: none;
    height: 16px;
    margin: 0;
    position: relative;
    transition: background-color $transitionDuration;
    width: 28px;

    &::after {
        background: $grey-0;
        border-radius: 50%;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
        content: '';
        height: 12px;
        left: 2px;
        position: absolute;
        top: 2px;
        transition: transform $transitionDuration;
        width: 12px;
    }

    &:checked {
        background: var(--lp-accent-green-deep);

        &::after {
            transform: translateX(12px);
        }
    }

    &:focus {
        outline: none;
    }

    &:focus-visible {
        outline: 2px solid var(--lp-link-blue);
        outline-offset: 2px;
    }
}

.lpToggleText {
    user-select: none;
}

.lpToggleDisabled {
    cursor: default;
    opacity: 0.5;

    .lpToggleControl {
        cursor: default;
    }
}

@media (prefers-reduced-motion: reduce) {
    .lpToggleControl,
    .lpToggleControl::after {
        transition: none;
    }
}
</style>
