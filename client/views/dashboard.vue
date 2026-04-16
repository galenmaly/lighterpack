<template>
    <div v-if="isLoaded" id="main" :class="{lpHasSidebar: library.showSidebar}">
        <sidebar />
        <div class="lpList lpTransition">
            <div id="header" class="clearfix">
                <span class="headerItem">
                    <a id="hamburger" class="lpTransition" data-testid="toggle-sidebar" @click="toggleSidebar"><i class="lpSprite lpHamburger" /></a>
                </span>
                <input id="lpListName" :value="list.name" type="text" class="lpListName lpSilent headerItem" placeholder="List Name" autocomplete="off" name="lastpass-disable-search" @input="updateListName">
                <share />
                <listSettings />
                <themeToggle />
                <accountDropdown v-if="isSignedIn" />
                <span v-else class="headerItem signInRegisterButtons">
                    <router-link to="/register" class="lpButton lpSmall">Register</router-link>
                    or
                    <router-link to="/signin" class="lpButton lpSmall">Sign In</router-link>
                </span>
                <span class="clearfix" />
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
import accountDropdown from '../components/account-dropdown.vue';
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
import themeToggle from '../components/theme-toggle.vue';

export default {
    name: 'Dashboard',
    components: {
        sidebar,
        share,
        listSettings,
        accountDropdown,
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
        themeToggle,
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

#header {
    align-items: baseline;
    display: flex;
    height: 60px;
    margin: 0 -20px 20px; /* lpList padding */
    position: relative;
}

#hamburger {
    cursor: pointer;
    display: inline-block;
    opacity: 0.6;
    transition: transform $transitionDurationSlow;

    &:hover {
        opacity: 1;
    }

    .lpHasSidebar & {
        transform: rotate(90deg);
    }
}

#lpListName {
    font-size: 24px;
    font-weight: 600;
    padding: 12px 15px;
}

.headerItem {
    flex: 0 0 auto;
    height: 100%;
    padding: 17px 16px;
    position: relative;

    &:first-child {
        padding-left: 20px;
    }

    .lpPopover {
        &:hover .lpTarget {
            color: $blue1;
        }
    }

    .lpTarget {
        font-weight: 600;
        padding: 17px 16px 15px;
    }

    &#lpListName {
        flex: 1 0 auto;
    }

    &.hasPopover {
        padding: 0;
    }

    &.signInRegisterButtons {
        height: auto;
        padding: 0 16px;
    }
}
</style>
