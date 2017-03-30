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

            <div v-if="isListNew" id="getStarted">
                <h2>Welcome to LighterPack!</h2>
                <p>Here's what you need to get started:</p>
                <ol>
                    <li>Click on things to edit them. Give your list and category a name.</li>
                    <li>Add new categories and items to your list.</li>
                    <li>When you're done, share your list with others!</li>
                </ol>
            </div>
            <list-summary v-if="!isListNew" :list="list"></list-summary>
            

            <div style="clear:both"></div>

            <div v-if="library.optionalFields['listDescription']" id="listDescriptionContainer">
                <h3>List Description</h3> <p>(<a href="https://guides.github.com/features/mastering-markdown/" target="_blank" class="lpHref">Markdown</a> supported)</p>
                <textarea id="listDescription"></textarea>
            </div>

            <ul class="lpCategories">
                <category v-for="category in categories" :category="category"></category>
            </ul>
            <hr />
            <a v-on:click="newCategory" class="lpAdd addCategory"><i class="lpSprite lpSpriteAdd"></i>Add new category</a>
            <div id="lpPickerContainer"><div id="lpPicker"></div></div>
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
        <itemLink></itemLink>
        <!--<account></account>
        <image-dialog></image-dialog>-->
       
        <!--<div class="lpDialog" id="itemImageDialog">
            <div class="columns">
                <div class="lpHalf">
                    <h2>Add image by URL</h2>
                    <form id="itemImageUrlForm">
                        <input type="text" id="itemImageUrl" placeholder="Image URL"/>
                        <input type="submit" class="lpButton" value="Save" />
                        <a href="#" class="lpHref close">Cancel</a>
                    </form>
                </div>
                <div class="lpHalf">
                    <h2>Upload image = require(disk</h2>
                    <p class="imageUploadDescription">Your image will be hosted on imgur.</p>
                    <button class="lpButton" id="itemImageUpload">Upload Image</button>
                    <a href="#" class="lpHref close">Cancel</a>
                    <p id="uploadingText" style="display:none;">Uploading image...</p>
                    <form id="imageUpload">
                        <input type="file" name="image" id="image" />
                    </form>
                </div>
            </div>
        </div>
        
        <div id="lpModalOverlay"></div>-->
    </div>
</template>

<script>
const sidebar = require("../components/sidebar.vue");
const share = require("../components/share.vue");
const listSettings = require("../components/list-settings.vue");
const accountDropdown = require("../components/account-dropdown.vue");
const forgotPassword = require("./forgotPassword.vue");
const account = require("./account.vue");
const todo = require("./todo.vue");
const help = require("./help.vue");
const imageDialog = require("./imageDialog.vue");
const listSummary = require("../components/list-summary.vue");
const category = require("../components/category.vue");

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
        listSummary: listSummary,
        category: category,
        itemLink: itemLink,
        copyList: copyList,
        importCSV: importCSV
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
        },
        categories() {
            return this.list.categoryIds.map((id) => {
                return this.library.getCategoryById(id);
            });
        },
        isListNew() {
            if (this.list.total === 0) {
                return true;
            }
            return false;
        }
    },
    methods: {
        toggleSidebar() {
            this.$store.commit("toggleSidebar");
        },
        newCategory() {
            this.$store.commit("newCategory", this.list);
        },
        updateListName(evt) {
            this.$store.commit("updateListName", {id: this.list.id, name: evt.target.value});
        }
    }
}
</script>