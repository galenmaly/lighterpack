<style lang="scss">
@import "../css/_globals";

$spinnerSize: 18px;

@keyframes spinner {
    to { transform: rotate(360deg); }
}

.lpSpinner::before {
    animation: spinner 0.6s linear infinite;
    border: 1px solid $orange1;
    border-radius: 50%;
    border-top-color: transparent;
    content: "";
    display: block;
    height: $spinnerSize;
    width: $spinnerSize;
}

.lpButton .lpSpinner {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);

    &::before {
        border-color: $background1;
        border-top-color: transparent;
    }
}
</style>

<template>
    <div class="lpSpinner" />
</template>

<script>
export default {
    name: 'Spinner',
};
</script>
