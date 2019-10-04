<style lang="scss">
@import "../css/_globals";

.lpGlobalAlerts {
    background: $yellow1;
    border: 1px solid $darkYellow;
    border-radius: 0 0 10px 10px;
    border-top: none;
    left: 50%;
    margin: 0;
    padding: 0;
    position: fixed;
    text-align: center;
    top: 0;
    transform: translateX(-50%);
    width: 50%;
    z-index: $aboveDialog;
}

.lpGlobalAlert {
    border-bottom: 1px solid $darkYellow;
    list-style-type: none;
    margin: 0;
    padding: $spacingMedium;

    &:last-child {
        border-bottom: none;
    }
}
</style>

<template>
    <ul v-if="alerts && alerts.length" class="lpGlobalAlerts">
        <li v-for="alert in alerts" class="lpGlobalAlert">
            {{ alert.message }}
        </li>
    </ul>
</template>

<script>

export default {
    name: 'GlobalAlerts',
    computed: {
        alerts() {
            return this.$store.state.globalAlerts;
        },
    },
};
</script>
