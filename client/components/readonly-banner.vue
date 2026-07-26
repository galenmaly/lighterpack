<style lang="scss">
@import "../css/_globals";

.lpReadOnlyBanner {
    background: $yellow2;
    border-bottom: 1px solid $darkYellow;
    font-weight: 600;
    padding: $spacingSmall $spacingMedium;
    position: relative;
    text-align: center;

    /* the sidebar is fixed and sits at $sidebar, so claim a layer above it */
    z-index: $aboveSidebar;
}
</style>

<template>
    <div v-if="readOnly.enabled" class="lpReadOnlyBanner">
        {{ readOnly.message }}
    </div>
</template>

<script>

export default {
    name: 'ReadonlyBanner',
    computed: {
        readOnly() {
            return this.$store.state.readOnly;
        },
    },
};
</script>
