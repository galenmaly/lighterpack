<template>
    <div v-if="isLoaded" id="main" :class="{lpHasSidebar: library.showSidebar, lpDrawerOpen: drawerOpen}">
        <div class="lpFrameFill lpFrameFillLeft" />
        <sidebar />
        <div class="lpDrawerScrim" data-testid="drawer-scrim" @click="closeDrawer" />
        <div class="lpContentCol">
            <div id="header">
                <span class="headerItem">
                    <a id="hamburger" class="lpTransition" data-testid="toggle-sidebar" @click="toggleSidebar"><i class="lpSprite lpHamburger" /></a>
                </span>
                <input id="lpListName" :value="list.name" type="text" class="lpListName lpSilent headerItem" placeholder="List Name" autocomplete="off" name="lastpass-disable-search" @input="updateListName">
                <share />
                <listSettings />
                <accountDropdown />
            </div>

            <list />

            <div id="lpFooter">
                <div class="lpSiteBy">
                    Site by <a class="lpHref" href="https://www.galenmaly.com/" target="_blank" rel="noopener noreferrer">Galen Maly</a>
                    and <a class="lpHref" href="https://github.com/galenmaly/lighterpack/graphs/contributors" target="_blank" rel="noopener noreferrer">friends</a>.
                </div>
                <div class="lpContact">
                    <a class="lpHref" href="https://github.com/galenmaly/lighterpack" target="_blank" rel="noopener noreferrer">Copyleft</a> LighterPack 2019
                    -
                    <a class="lpHref" href="mailto:info@lighterpack.com">Contact</a>
                </div>
            </div>
        </div>
        <div class="lpFrameFill lpFrameFillRight" />

        <globalAlerts />
        <speedbump
            :shown="showSpeedbump"
            :speedbump-callback="speedbumpCallback"
            :speedbump-options="speedbumpOptions"
            @hide="showSpeedbump = false"
        />
        <copyList :shown="showCopyList" @hide="showCopyList = false" />
        <importCSV ref="importCSVRef" />
        <itemImage :shown="showItemImage" :item="itemImageItem" @hide="showItemImage = false" />
        <itemViewImage :shown="showItemViewImage" :image-url="itemViewImageUrl" @hide="showItemViewImage = false" />
        <itemLink :shown="showItemLink" :item="itemLinkItem" @hide="showItemLink = false" />
        <help :shown="showHelp" @hide="showHelp = false" />
        <account :shown="showAccount" @hide="showAccount = false" />
        <accountDelete :shown="showDeleteAccount" @hide="showDeleteAccount = false" />
    </div>
</template>

<script>
import globalAlerts from '../components/global-alerts.vue';
import sidebar from '../components/sidebar.vue';
import share from '../components/share.vue';
import listSettings from '../components/list-settings.vue';
import account from '../components/account.vue';
import accountDelete from '../components/account-delete.vue';
import help from '../components/help.vue';
import list from '../components/list.vue';

import itemImage from '../components/item-image.vue';
import itemViewImage from '../components/item-view-image.vue';
import itemLink from '../components/item-link.vue';
import importCSV from '../components/import-csv.vue';
import copyList from '../components/copy-list.vue';
import speedbump from '../components/speedbump.vue';
import accountDropdown from '../components/account-dropdown.vue';

import { isMobile } from '../utils/viewport.js';

export default {
    name: 'Dashboard',
    components: {
        sidebar,
        share,
        listSettings,
        account,
        accountDelete,
        help,
        list,
        itemLink,
        copyList,
        importCSV,
        itemImage,
        itemViewImage,
        speedbump,
        globalAlerts,
        accountDropdown,
    },
    provide() {
        return {
            openAccount: () => { this.showAccount = true; },
            openHelp: () => { this.showHelp = true; },
            openDeleteAccount: () => { this.showDeleteAccount = true; },
            openCopyList: () => { this.showCopyList = true; },
            openImportCSV: () => { this.$refs.importCSVRef.triggerUpload(); },
            openItemImage: (item) => { this.itemImageItem = item; this.showItemImage = true; },
            openItemViewImage: (imageUrl) => { this.itemViewImageUrl = imageUrl; this.showItemViewImage = true; },
            openItemLink: (item) => { this.itemLinkItem = item; this.showItemLink = true; },
            initSpeedbump: (callback, options) => {
                this.speedbumpCallback = callback;
                this.speedbumpOptions = options;
                this.showSpeedbump = true;
            },
        };
    },
    setup() {
        return { isMobile };
    },
    data() {
        return {
            isLoaded: false,
            drawerOpen: false,
            showAccount: false,
            showHelp: false,
            showDeleteAccount: false,
            showCopyList: false,
            showItemImage: false,
            itemImageItem: null,
            showItemViewImage: false,
            itemViewImageUrl: '',
            showItemLink: false,
            itemLinkItem: null,
            showSpeedbump: false,
            speedbumpCallback: null,
            speedbumpOptions: null,
        };
    },
    computed: {
        library() {
            return this.$store.state.library;
        },
        list() {
            return this.library.getListById(this.library.defaultListId);
        },
        isSignedIn() {
            return this.$store.state.loggedIn;
        },
    },
    watch: {
        // Picking a list is the drawer's whole job, so it gets out of the way
        // once you have. Watching the id rather than wiring a callback through
        // library-lists keeps the drawer's business in the drawer's owner.
        'library.defaultListId': function closeOnListChange() {
            this.drawerOpen = false;
        },
    },
    beforeMount() {
        if (!this.$store.state.library) {
            this.$router.push('/welcome');
        } else {
            this.isLoaded = true;
        }
    },
    methods: {
        // The rail's collapsed state is a saved account preference
        // (library.showSidebar, serialized with the library); the phone drawer
        // is throwaway view state. Keeping them separate means opening the
        // drawer on a phone doesn't collapse the rail on the desktop.
        toggleSidebar() {
            if (this.isMobile) {
                this.drawerOpen = !this.drawerOpen;
            } else {
                this.$store.commit('toggleSidebar');
            }
        },
        closeDrawer() {
            this.drawerOpen = false;
        },
        updateListName(evt) {
            this.$store.commit('updateListName', { id: this.list.id, name: evt.target.value });
        },
    },
};
</script>

<style lang="scss">
@import "../css/_globals";

// App frame: dark filler | 220px sidebar | 1060px content | light filler.
// The sidebar + content cluster centers as a unit; the fillers bleed the two
// surfaces to the viewport edges so nothing looks boxed. Overrides the base
// #main rules in _base.scss (shared with the share bundle, so not edited there).
#main {
    display: flex;
    margin: 0;
    max-width: none;
    min-height: 100vh;

    &.lpHasSidebar {
        max-width: none;
    }
}

.lpFrameFill {
    flex: 1 1 0;
    min-width: 0;
}

// The left filler carries the rail's surface out to the viewport edge, so it
// has to change surface on the same beat the rail collapses — swapping it
// outright reads as a flash next to the sliding rail.
.lpFrameFillLeft {
    background: var(--lp-content-bg);
    transition: background-color $transitionDurationSlow;

    .lpHasSidebar & {
        background: var(--lp-sidebar-bg);
    }
}

.lpFrameFillRight {
    background: var(--lp-content-bg);
}

.lpContentCol {
    background: var(--lp-content-bg);
    color: var(--lp-text);
    display: flex;
    flex: 0 1 1060px;
    flex-direction: column;
    min-width: 0;
    width: 1060px;
}

@media only screen and (width <= 1300px) {
    .lpFrameFill {
        display: none;
    }

    .lpContentCol {
        flex: 1 1 auto;
    }
}

#header {
    align-items: center;
    display: flex;
    flex: 0 0 auto;
    gap: 18px;
    padding: 13px 32px;

    .lpTarget  .lpSprite {
        height: 14px;
    }
}

#hamburger {
    cursor: pointer;
    display: inline-block;
    opacity: 0.5;
    transition: transform $transitionDurationSlow;

    &:hover {
        opacity: 1;
    }

    .lpHasSidebar & {
        transform: rotate(90deg);
    }
}

// Rename affordance matches the item rows: a quiet box that outlines on
// hover and fills on focus, never an underline. The negative margin cancels
// the box's own padding so the title text keeps its place in the header.
#lpListName {
    flex: 1 1 auto;
    font-size: 22px;
    font-weight: 700;
    margin-left: -3px;
    min-width: 0;
    padding: 3px 7px;
    transition: border-color $transitionDuration;

    &:hover {
        border-color: var(--lp-border);
    }

    &:focus {
        background: var(--lp-bg);
        border-color: var(--lp-border-strong);
    }
}

.headerItem {
    flex: 0 0 auto;
    position: relative;

    .lpTarget {
        color: var(--lp-text);
        font-size: 13px;
        font-weight: 600;
        padding: 4px 0;

        &:hover {
            color: var(--lp-link-blue);
        }
    }

    &.lpAccount {
        padding-left: 20px;

        &:before {
            content: "";
            display: block;
            position: absolute;
            top: 2px;
            bottom: 0px;
            width: 1px;
            background: var(--lp-border-strong);
            left: 0;
        }
    }
}

#lpFooter {
    color: var(--lp-text-secondary);
    display: flex;
    font-size: 12px;
    justify-content: space-between;
    margin-top: auto;
    padding: 80px 56px 20px;
}

// Dims the list behind the open drawer and catches the tap that closes it.
// Inert until the drawer opens, so it never eats a click on the desktop.
.lpDrawerScrim {
    display: none;
}

// ============================================================
// Phone layout — app bar (#18a) and drawer (#11f)
//
// The three-region desktop frame (dark filler | rail | content | light
// filler) collapses to one column: the fillers have nothing to bleed to at
// this width, and the rail lifts out of the flow into an overlay drawer.
// ============================================================
@media only screen and (width <= $mobile) {
    #main {
        display: block;
    }

    .lpFrameFill {
        display: none;
    }

    .lpContentCol {
        display: block;
        width: auto;
    }

    // The header stops being page chrome and becomes the app bar: dark, full
    // bleed, and stuck to the top so the list title and the drawer stay
    // reachable well down a long list.
    #header {
        background: var(--lp-sidebar-bg);
        color: var(--lp-sidebar-text);
        gap: 12px;
        padding: 11px 14px;
        position: sticky;
        top: 0;
        z-index: $mobileHeader;
    }

    #hamburger {
        color: var(--lp-sidebar-text);
        opacity: 1;
    }

    // On the desktop the hamburger rotates with the rail; here it tracks the
    // drawer instead, so the saved rail state must stop driving it.
    #main.lpHasSidebar #hamburger {
        transform: none;
    }

    #main.lpDrawerOpen #hamburger {
        transform: rotate(90deg);
    }

    #lpListName {
        color: var(--lp-sidebar-text);
        font-size: 17px;
        margin-left: -5px;
        padding: 3px 5px;

        // The desktop rename affordance outlines on hover, which a phone can't
        // do; the field is still tappable, it just stays quiet until focused.
        &:hover {
            border-color: transparent;
        }

        &:focus {
            background: var(--lp-sidebar-inset);
            border-color: var(--lp-sidebar-border);
        }
    }

    // Share / Settings / account collapse to their icons — the labels don't fit
    // beside a list title at 390px. font-size: 0 drops the label text node
    // without touching the sprite, which carries its own px dimensions.
    // Centred with flex rather than left to inline layout: font-size: 0
    // collapses the line box these icons would otherwise sit on the baseline
    // of, which hung them 2px above the app bar's centre.
    .headerItem .lpTarget,
    .headerItem .lpTarget > span {
        align-items: center;
        display: flex;
    }

    .headerItem .lpTarget {
        color: var(--lp-sidebar-text);
        font-size: 0;
        padding: 0;

        .lpSprite {
            height: 17px;
            top: 0;
            width: 17px;
        }

        &:hover {
            color: var(--lp-sidebar-text);
        }
    }

    // The rule dividing the avatar from the other actions is desktop chrome;
    // at this width the gap reads on its own.
    .headerItem.lpAccount {
        padding-left: 0;

        &:before {
            display: none;
        }
    }

    // Header menus hang off the viewport: they're anchored to a control a few
    // pixels from the right edge, and the desktop flyout centres itself on
    // that control — which put the Share menu 19px past the left edge.
    //
    // Dropping the popover's own positioning context lets the content resolve
    // against the sticky header instead. That's full-bleed, so the menu can
    // span the screen with a margin either side and sit directly under the app
    // bar, which is where a phone expects it.
    // Both of these are positioned on the desktop, and either one would
    // capture the menu as its containing block.
    .headerItem,
    .headerItem .lpPopover {
        position: static;
    }

    // Full bleed, flush to the app bar, rounded only where it ends: the menu
    // reads as a panel pulled down out of the header rather than a card
    // floating under it. #main raises specificity over popover.vue's own
    // .lpPopoverShown rules, whose injection order isn't guaranteed.
    #main .headerItem .lpPopover .lpContent {
        border-radius: 0 0 12px 12px;
        left: 0;
        margin-top: 0;
        // Settings can outgrow a short screen once every optional field and
        // the currency box are in it.
        max-height: calc(100vh - 80px);
        overflow-y: auto;
        right: 0;
        // Slides the last few pixels into place as it fades in.
        transform: translateY(-8px);
        white-space: normal;
    }

    #main .headerItem .lpPopover.lpPopoverShown .lpContent {
        margin-top: 0;
        transform: none;
    }

    // The bridge that lets a mouse travel from target to menu across the gap.
    // There's no travelling on a touch screen, and the padding it adds pushes
    // the avatar off the app bar's centre.
    .headerItem .lpPopover .lpTarget {
        margin-bottom: 0;
        padding-bottom: 0;
    }

    .lpDrawerScrim {
        background: rgba(0, 0, 0, 0.35);
        display: block;
        inset: 0;
        opacity: 0;
        pointer-events: none;
        position: fixed;
        transition: opacity $transitionDurationSlow;
        z-index: $mobileScrim;

        .lpDrawerOpen & {
            opacity: 1;
            pointer-events: all;
        }
    }

    #lpFooter {
        flex-direction: column;
        gap: 4px;
        padding: 40px 14px 20px;
    }
}
</style>
