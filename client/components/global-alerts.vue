<template>
    <ul v-if="alerts && alerts.length" class="lpGlobalAlerts">
        <li v-for="alert in alerts" :key="alert.message" class="lpGlobalAlert">
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

<style lang="scss">
@import "../css/_globals";

.lpGlobalAlerts {
    background: var(--lp-alert-bg);
    border: 1px solid var(--lp-alert-border);
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
    border-bottom: 1px solid var(--lp-alert-border);
    list-style-type: none;
    margin: 0;
    padding: $spacingMedium;

    &:last-child {
        border-bottom: none;
    }
}
</style>
