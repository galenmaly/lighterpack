<style lang="scss">
@import "../css/_globals";

.lpGlobalAlerts {
    position: fixed;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    background: $yellow1;
    z-index: $aboveDialog;
    margin: 0;
    padding: 0;
    text-align: center;
    width: 50%;
    border-radius: 0 0 10px 10px;
    border: 1px solid $darkYellow;
    border-top: none;
}

.lpGlobalAlert {
    padding: $spacingMedium;
    margin: 0;
    border-bottom: 1px solid $darkYellow;
    list-style-type: none;

    &:last-child {
        border-bottom: none;
    }
}
</style>

<template>
    <ul v-if="alerts && alerts.length" class="lpGlobalAlerts">
        <li class="lpGlobalAlert" v-for="alert in alerts">
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
