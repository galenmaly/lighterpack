<template>
    <div id="sidebar">
        <div class="lpSidebarSticky">
            <h1 class="lpWordmark">
                LighterPack
            </h1>

            <libraryLists />
            <div class="lpSidebarDivider" />
            <router-link v-if="isMobile" to="/gear" class="lpSidebarNav" data-testid="drawer-gear">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
                Gear library
                <span class="lpSidebarNavCount">{{ library.items.length }}</span>
            </router-link>
            <libraryItems v-else />
        </div>
    </div>
</template>

<script>
import libraryItems from './library-items.vue';
import libraryLists from './library-lists.vue';

import { isMobile } from '../utils/viewport.js';

export default {
    name: 'Sidebar',
    components: {
        libraryItems,
        libraryLists,
    },
    setup() {
        return { isMobile };
    },
    computed: {
        library() {
            return this.$store.state.library;
        },
    },
};
</script>

<style lang="scss">
@import "../css/_globals";

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
    padding-right: 1px;
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

// ============================================================
// Phone layout — the rail becomes an overlay drawer (#11f)
//
// The rail leaves the flow entirely and becomes a fixed panel sliding in over
// the list, with dashboard.vue's scrim behind it. The saved rail state stops
// driving anything here (the local drawerOpen flag does), so both branches of
// the desktop lpHasSidebar rules have to be neutralised — hence the doubled
// selectors, which match the desktop rules' specificity and win on order.
// ============================================================
@media only screen and (width <= $mobile) {
    #sidebar,
    #main:not(.lpHasSidebar) #sidebar {
        background: var(--lp-sidebar-bg);
        bottom: 0;
        // The desktop clip stops the fixed-width inner column painting outside
        // a collapsing rail. The drawer slides as one piece, so the clip has
        // nothing to do but interfere with the shadow.
        clip-path: none;
        flex: none;
        left: 0;
        // Leave a strip of the list visible so the drawer reads as an overlay
        // and there's somewhere obvious to tap to dismiss it.
        max-width: 85vw;
        position: fixed;
        top: 0;
        transform: translateX(-100%);
        transition: transform $transitionDurationSlow;
        width: 296px;
        z-index: $sidebar;
    }

    #main.lpDrawerOpen #sidebar {
        box-shadow: 6px 0 24px rgba(0, 0, 0, 0.35);
        transform: none;
    }

    // The sticky inner column is a desktop device for pinning the rail while
    // the content scrolls; the drawer is already fixed, so it just fills it.
    #sidebar .lpSidebarSticky,
    #main:not(.lpHasSidebar) .lpSidebarSticky {
        height: 100%;
        opacity: 1;
        position: static;
        width: 100%;
    }

    #sidebar .lpWordmark {
        font-size: 18px;
        padding: 16px 18px 12px;
    }

    // Touch targets: the section headers' "+ New" and the rows below it are
    // 11–13px text on the desktop, which is under the 44px floor by a mile.
    .lpSidebarSectionHeader {
        padding: 8px 18px 6px;
    }

    .lpSectionLabel {
        font-size: 11px;
    }

    .lpSidebarNew {
        font-size: 13px;
        padding: 6px 0 6px 12px;
    }

    // With the gear list gone the lists region is the drawer's main content,
    // so let it use the height rather than capping at the rail's ~7 rows.
    .lpSidebarListsRegion #lists {
        max-height: 60vh;
    }
}

// Drawer nav row (phone only — rendered behind v-if, so no media query).
.lpSidebarNav {
    align-items: center;
    color: var(--lp-sidebar-text);
    display: flex;
    flex: 0 0 auto;
    font-size: 14px;
    gap: 10px;
    padding: 14px 18px;
    text-decoration: none;

    svg {
        color: var(--lp-sidebar-muted);
        flex: 0 0 auto;
    }
}

.lpSidebarNavCount {
    color: var(--lp-sidebar-muted);
    font-size: 11.5px;
    margin-left: auto;
}
</style>
