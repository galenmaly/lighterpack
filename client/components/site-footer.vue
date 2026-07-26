<template>
    <div class="lpSiteFooter" :class="{ lpSiteFooterFixed: fixed }">
        <div class="lpSiteFooterCredit">
            Site by <a class="lpHref" href="https://www.galenmaly.com/" target="_blank" rel="noopener noreferrer">Galen Maly</a>
            -
            <a class="lpHref" href="https://ko-fi.com/lighterpack" target="_blank" rel="noopener noreferrer">Donate</a>
        </div>
        <div class="lpSiteFooterLinks">
            <a class="lpHref" href="https://github.com/galenmaly/lighterpack" target="_blank" rel="noopener noreferrer">Copyleft</a> LighterPack {{ year }}
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
    name: 'SiteFooter',
    props: {
        // The welcome and auth pages sit on the photo background with nothing
        // below the fold to anchor a footer, so theirs is pinned to the
        // viewport over the blackout instead of ending the page.
        fixed: {
            type: Boolean,
            default: false,
        },
    },
    computed: {
        // Read once at render rather than baked into the markup -- the year
        // spent seven of them reading 2019.
        year() {
            return new Date().getFullYear();
        },
    },
};
</script>

<style lang="scss">
@import "../css/_globals";

.lpSiteFooter {
    color: var(--lp-text-secondary);
    display: flex;
    font-size: 12px;
    justify-content: space-between;
}

// One line each on a phone: side by side, the two halves wrap into a block tall
// enough to cover whatever they are sitting over.
@media only screen and (width <= $mobile) {
    .lpSiteFooter {
        flex-direction: column;
        gap: 4px;
    }
}

.lpSiteFooterFixed {
    background: var(--lp-welcome-footer-bg);
    bottom: 0;
    left: 0;
    padding: $spacingSmall;
    position: fixed;
    right: 0;
    z-index: $blackoutFooter;

    @media only screen and (width <= $mobile) {
        align-items: center;
        gap: 2px;
        padding: 8px 12px;
        text-align: center;
    }
}
</style>
