<style lang="scss">

</style>

<template>
    <div id="main" :class="{lpHasSidebar: library.showSidebar, lpTransition: true}" v-if="isLoaded">
        <sidebar></sidebar>
        <div class="lpList lpTransition">
            <div id="header" class="clearfix">
                <span class="headerItem">
                    <a v-on:click="toggleSidebar" id="hamburger" class="lpTransition"><i class="lpSprite lpHamburger"></i></a>
                </span>
                <input v-on:input="updateListName" :value="list.name" id="lpListName" type="text" class="lpListName lpSilent headerItem" value="New List" placeholder="List Name" autocomplete="off" name="lastpass-disable-search"/>
                <share></share>
                <listSettings></listSettings>
                <accountDropdown></accountDropdown>
                <span class="clearfix"></span>
            </div>

            <list></list>
            
            <div id="lpFooter">
                <div class="lpSiteBy">Site by <a class="lpHref" href="http://www.galenmaly.com/">Galen Maly</a></div>
                <div class="lpContact">
                    Copyleft LighterPack 2016
                    -
                    <a class="lpHref" href="https://github.com/galenmaly/lighterpack">Fork me on GitHub</a>
                    -
                    <a class="lpHref" href="mailto:info@lighterpack.com">Contact</a></div>
            </div>
        </div>

        <copyList></copyList>
        <importCSV></importCSV>
        <itemImage></itemImage>
        <itemLink></itemLink>
        <todo></todo>
        <help></help>
        <account></account>
        <colorPicker></colorPicker>

        <!--<image-dialog></image-dialog>-->
    </div>
</template>

<script>
const sidebar = require("../components/sidebar.vue");
const share = require("../components/share.vue");
const listSettings = require("../components/list-settings.vue");
const accountDropdown = require("../components/account-dropdown.vue");
const forgotPassword = require("./forgotPassword.vue");
const account = require("../components/account.vue");
const todo = require("../components/todo.vue");
const help = require("../components/help.vue");
const imageDialog = require("./imageDialog.vue");
const list = require("../components/list.vue");

const colorPicker = require("../components/colorpicker.vue");
const itemImage = require("../components/item-image.vue");
const itemLink = require("../components/item-link.vue");
const importCSV = require("../components/import-csv.vue");
const copyList = require("../components/copy-list.vue");

module.exports = {
    name: "dashboard",
    mixins: [],
    components: {
        sidebar: sidebar,
        share: share,
        listSettings: listSettings,
        accountDropdown: accountDropdown,
        forgotPassword: forgotPassword,
        account: account,
        todo: todo,
        help: help,
        imageDialog: imageDialog,
        list: list,
        colorPicker: colorPicker,
        itemLink: itemLink,
        copyList: copyList,
        importCSV: importCSV,
        itemImage: itemImage
    },
    data: function() {
        return {
            isLoaded: true
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
    }
}
</script>