<template>
    <div id="sidebar">
        <div class="lpSidebarSticky">
            <h1 class="lpWordmark">
                LighterPack
            </h1>

            <libraryLists />
            <div class="lpSidebarDivider" />
            <libraryItems />
            <accountDropdown />
        </div>
    </div>
</template>

<script>
import libraryItems from './library-items.vue';
import libraryLists from './library-lists.vue';
import accountDropdown from './account-dropdown.vue';

export default {
    name: 'Sidebar',
    components: {
        libraryItems,
        libraryLists,
        accountDropdown,
    },
};
</script>

<style lang="scss">
@import "../css/_globals";

// Fixed dark rail: the sticky inner column pins to the viewport while the
// window scrollbar scrolls the content column only. Collapses to zero width
// when the sidebar is toggled off.
#sidebar {
    background: var(--lp-sidebar-bg);
    color: var(--lp-sidebar-text);
    flex: 0 0 220px;
    transition: flex-basis $transitionDurationSlow;
    z-index: $sidebar;

    // Clip only while collapsed — popovers (+ New flyout, account menu)
    // must be free to overhang the content column when the rail is open.
    #main:not(.lpHasSidebar) & {
        flex-basis: 0;
        overflow: hidden;
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
