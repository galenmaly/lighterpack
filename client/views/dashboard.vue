<template>
    <div v-if="isLoaded" id="main" :class="{lpHasSidebar: library.showSidebar}">
        <div class="lpFrameFill lpFrameFillLeft" />
        <sidebar />
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
    data() {
        return {
            isLoaded: false,
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
    beforeMount() {
        if (!this.$store.state.library) {
            this.$router.push('/welcome');
        } else {
            this.isLoaded = true;
        }
    },
    methods: {
        toggleSidebar() {
            this.$store.commit('toggleSidebar');
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
</style>
