<style lang="scss">
@import "../css/_globals";

#header {
    box-sizing: border-box;
    display: flex;
    height: 60px;
    margin: 0 -20px 20px; /* lpList padding */
    position: relative;

    * {
        box-sizing: inherit;
    }
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

    .lpFlyout {
        height: 100%;

        &:hover .lpTarget {
            color: $blue1;
        }
    }

    .lpTarget {
        font-weight: 600;
        height: 100%;
        padding: 17px 16px;
    }

    .lpContent {
        background-color: #fff;
        box-shadow: 0 0 6px rgba(0, 0, 0, 0.25);
        left: 50%;
        transform: translateX(-50%);

        &::before {
            background-color: #fff;
            box-shadow: 0 0 6px rgba(0, 0, 0, 0.25);
            content: "";
            display: block;
            height: 20px;
            left: 50%;
            margin-left: -10px;
            position: absolute;
            top: -10px;
            transform: rotate(45deg);
            width: 20px;
            z-index: $dialog - 1;
        }

        &::after {
            background: #fff;
            content: "";
            display: block;
            height: 15px;
            left: 0;
            position: absolute;
            top: 0;
            width: 100%;
            z-index: $dialog + 1;
        }
    }

    &#lpListName {
        flex: 1 0 auto;
    }

    &.hasFlyout {
        padding: 0;
    }
}
</style>

<template>
    <div id="main" :class="{lpHasSidebar: library.showSidebar}" v-if="isLoaded">
        <sidebar></sidebar>
        <div class="lpList lpTransition">
            <div id="header" class="clearfix">
                <span class="headerItem">
                    <a @click="toggleSidebar" id="hamburger" class="lpTransition"><i class="lpSprite lpHamburger"></i></a>
                </span>
                <input @input="updateListName" :value="list.name" id="lpListName" type="text" class="lpListName lpSilent headerItem" value="New List" placeholder="List Name" autocomplete="off" name="lastpass-disable-search"/>
                <share></share>
                <listSettings></listSettings>
                <accountDropdown></accountDropdown>
                <span class="clearfix"></span>
            </div>

            <list></list>
            
            <div id="lpFooter">
                <div class="lpSiteBy">Site by <a class="lpHref" href="http://www.galenmaly.com/">Galen Maly</a></div>
                <div class="lpContact">
                    Copyleft LighterPack 2017
                    -
                    <a class="lpHref" href="https://github.com/galenmaly/lighterpack">Fork me on GitHub</a>
                    -
                    <a class="lpHref" href="mailto:info@lighterpack.com">Contact</a></div>
            </div>
        </div>

        <speedbump></speedbump>
        <copyList></copyList>
        <importCSV></importCSV>
        <itemImage></itemImage>
        <itemViewImage></itemViewImage>
        <itemLink></itemLink>
        <todo></todo>
        <help></help>
        <account></account>
        <accountDelete></accountDelete>
        <colorPicker></colorPicker>
    </div>
</template>

<script>
import sidebar from "../components/sidebar.vue";
import share from "../components/share.vue";
import listSettings from "../components/list-settings.vue";
import accountDropdown from "../components/account-dropdown.vue";
import forgotPassword from "./forgot-password.vue";
import account from "../components/account.vue";
import accountDelete from "../components/account-delete.vue";
import todo from "../components/todo.vue";
import help from "../components/help.vue";
import list from "../components/list.vue";

import colorPicker from "../components/colorpicker.vue";
import itemImage from "../components/item-image.vue";
import itemViewImage from "../components/item-view-image.vue";
import itemLink from "../components/item-link.vue";
import importCSV from "../components/import-csv.vue";
import copyList from "../components/copy-list.vue";
import speedbump from "../components/speedbump.vue";

export default {
    name: "dashboard",
    mixins: [],
    components: {
        sidebar,
        share,
        listSettings,
        accountDropdown,
        forgotPassword,
        account,
        accountDelete,
        todo,
        help,
        list,
        colorPicker,
        itemLink,
        copyList,
        importCSV,
        itemImage,
        itemViewImage,
        speedbump
    },
    data: function() {
        return {
            isLoaded: false
        };
    },
    computed: {
        library() {
            return this.$store.state.library;
        },
        list() {
            return this.library.getListById(this.library.defaultListId);
        }
    },
    methods: {
        toggleSidebar() {
            this.$store.commit("toggleSidebar");
        },
        updateListName(evt) {
            this.$store.commit("updateListName", {id: this.list.id, name: evt.target.value});
        }
    },
    beforeMount() {
        if (!this.$store.state.library) {
            router.push("/welcome");
        } else {
            this.isLoaded = true;
        }
    }
}
</script>