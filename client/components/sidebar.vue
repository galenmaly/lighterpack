<template>
    <div id="sidebar">
        <div class="lpSidebarSticky">
            <h1 class="lpWordmark">
                LighterPack
            </h1>

            <libraryLists />
            <div class="lpSidebarDivider" />
            <libraryItems />
        </div>
    </div>
</template>

<script>
import libraryItems from './library-items.vue';
import libraryLists from './library-lists.vue';

export default {
    name: 'Sidebar',
    components: {
        libraryItems,
        libraryLists,
    },
};
</script>

<style lang="scss">
@import "../css/_globals";

// Fixed dark rail: the sticky inner column pins to the viewport while the
// window scrollbar scrolls the content column only. Collapses to zero width
// when the sidebar is toggled off.
// min-width is what actually lets flex-basis animate: the inner column is a
// fixed 220px, so the rail's automatic minimum size pins it at 220px and
// flex-basis: 0 does nothing until that floor is lifted.
//
// Clipping is then its own concern, and it has to hold for the whole collapse
// *and* the whole expand so the inner column is never painted wider than the
// rail carrying it. The clip is released — instantly, one beat late — only once
// the rail is fully open, which is the only moment popovers (the + New flyout)
// need to overhang the content column. clip-path rather than overflow: overflow
// would make the rail a scroll container and unpin .lpSidebarSticky.
#sidebar {
    background: var(--lp-sidebar-bg);
    clip-path: inset(-100vh -100vw);
    color: var(--lp-sidebar-text);
    flex: 0 0 220px;
    min-width: 0;
    transition: flex-basis $transitionDurationSlow, clip-path 0s $transitionDurationSlow, background $transitionDurationSlow;
    z-index: $sidebar;

    #main:not(.lpHasSidebar) & {
        background: var(--lp-bg);
        clip-path: inset(0);
        flex-basis: 0;
        transition: flex-basis $transitionDurationSlow, clip-path 0s, background $transitionDurationSlow;
    }
}

.lpSidebarSticky {
    display: flex;
    flex-direction: column;
    height: 100vh;
    opacity: 1;
    position: sticky;
    top: 0;
    transition: opacity $transitionDurationSlow;
    width: 220px;

    #main:not(.lpHasSidebar) & {
        opacity: 0;
    }
}

#sidebar .lpWordmark {
    flex: 0 0 auto;
    font-size: 17px;
    font-weight: 700;
    margin: 0;
    padding: 16px 18px 10px;
}

.lpSidebarDivider {
    border-top: 1px solid var(--lp-sidebar-border);
    flex: 0 0 auto;
    margin: 6px 18px 0;
}

// Shared section chrome (LISTS · n / GEAR · n headers, + New action)
.lpSidebarSectionHeader {
    align-items: center;
    display: flex;
    flex: 0 0 auto;
    padding: 2px 18px 4px;
}

.lpSectionLabel {
    color: var(--lp-sidebar-muted);
    flex: 1 1 auto;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
}

.lpSidebarNew {
    color: var(--lp-accent-green-deep);
    cursor: pointer;
    font-size: 11.5px;
    font-weight: 600;

    &:hover {
        text-decoration: underline;
    }
}

// Thin overlay scrollbars for the two independently scrolling regions.
.lpSidebarScroll {
    overflow-y: auto;
    scrollbar-color: rgba(255, 255, 255, 0.45) transparent;
    scrollbar-width: thin;

    &::-webkit-scrollbar {
        width: 6px;
    }

    &::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.45);
        border-radius: 3px;
    }
}
</style>
