<template>
    <div id="lpWelcomeFooter">
        <div class="lpSiteBy">
            Site by <a class="lpHref" href="https://www.galenmaly.com/" target="_blank" rel="noopener noreferrer">Galen Maly</a>
            and <a class="lpHref" href="https://github.com/galenmaly/lighterpack/graphs/contributors" target="_blank" rel="noopener noreferrer">friends</a>.
        </div>
        <div class="lpContact">
            <a class="lpHref" href="https://github.com/galenmaly/lighterpack" target="_blank" rel="noopener noreferrer">Copyleft</a> LighterPack 2019
            -
            <a class="lpHref" href="mailto:info@lighterpack.com">Contact</a>
            -
            <a class="lpHref" href="/privacy">Privacy</a>
            -
            <a class="lpHref" href="/terms">Terms</a>
        </div>
    </div>
</template>

<script>
export default {
    name: 'BlackoutFooter',
};
</script>

<style lang="scss">
@import "../css/_globals";

// The footer stays pinned to the bottom, but its two halves sit side by side
// and wrap into a tall block at this width — tall enough to cover the
// register button behind it. Stack them instead and keep it compact.
// (#lpWelcomeFooter's base rules live in _base.scss, which the share bundle
// also compiles, so the phone override lives here in the app bundle.)
@media only screen and (width <= $mobile) {
    #lpWelcomeFooter {
        align-items: center;
        flex-direction: column;
        font-size: 12px;
        gap: 2px;
        padding: 8px 12px;
        text-align: center;
    }
}
</style>
