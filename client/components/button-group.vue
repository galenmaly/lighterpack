<template>
    <div class="lpButtonGroup" role="radiogroup" :aria-label="label">
        <label
            v-for="option in options"
            :key="option.value"
            class="lpButtonGroupOption"
            :class="{ lpButtonGroupOptionSelected: option.value === modelValue }"
        >
            <input
                type="radio"
                class="lpButtonGroupControl"
                :name="groupName"
                :value="option.value"
                :checked="option.value === modelValue"
                :data-testid="option.testid"
                @change="$emit('update:modelValue', option.value)"
            >
            <span class="lpButtonGroupText">{{ option.label }}</span>
        </label>
    </div>
</template>

<script>
// Radios need a name to behave as one group, and two groups sharing a name on
// the same page would steal each other's selection.
let groupCount = 0;

export default {
    name: 'ButtonGroup',
    props: {
        // [{ value, label, testid? }] — rendered left to right.
        options: {
            type: Array,
            required: true,
        },
        modelValue: {
            type: [String, Number],
            default: '',
        },
        // Names the group for screen readers; the segments alone don't say
        // what they're picking between.
        label: {
            type: String,
            default: '',
        },
    },
    emits: ['update:modelValue'],
    data() {
        return {
            groupName: `lpButtonGroup${groupCount++}`,
        };
    },
};
</script>

<style lang="scss">
@import "../css/_globals";

/* Segmented control: real radios wearing buttons, so one choice is always
   made, arrow keys move between segments, and the label association comes
   free. The hairline outline keeps it legible on any surface — an inset
   track would have to match a background that differs per theme. */
.lpButtonGroup {
    border: 1px solid var(--lp-border-strong);
    border-radius: 6px;
    display: flex;
    overflow: hidden;
}

.lpButtonGroupOption {
    color: var(--lp-text-secondary);
    cursor: pointer;
    flex: 1 1 0;
    font-size: 12px;
    line-height: 18px;
    padding: 3px 10px;
    position: relative;
    text-align: center;
    transition: background-color $transitionDuration, color $transitionDuration;
    user-select: none;
    white-space: nowrap;

    + .lpButtonGroupOption {
        border-left: 1px solid var(--lp-border-strong);
    }

    &:hover {
        background: var(--lp-row-hover);
        color: var(--lp-text);
    }
}

.lpButtonGroupOptionSelected {
    &,
    &:hover {
        background: var(--lp-selected-bg);
        color: $grey-0;
    }
}

/* The radio itself is the focus target, the state, and the hit area — it just
   isn't drawn. Stretched over the segment rather than hidden in a corner so a
   click lands on the control instead of on text that happens to sit above it. */
.lpButtonGroupControl {
    appearance: none;
    -webkit-appearance: none;
    cursor: pointer;
    inset: 0;
    margin: 0;
    opacity: 0;
    position: absolute;

    &:focus-visible + .lpButtonGroupText::after {
        border: 2px solid var(--lp-link-blue);
        border-radius: 4px;
        content: '';
        inset: 1px;
        position: absolute;
    }
}

@media (prefers-reduced-motion: reduce) {
    .lpButtonGroupOption {
        transition: none;
    }
}
</style>
