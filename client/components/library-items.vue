<style lang="scss">
</style>

<template>
    <section id="libraryContainer">
        <h2>Gear</h2>
        <input type="text" id="librarySearch" placeholder="search items" v-model="searchText"/>
        <ul id="library">
            <li v-for="item in filteredItems" class="lpLibraryItem">
                <a v-if="item.url" :href="item.url" target="_blank" class="lpName lpHref">{{item.name}}</a>
                <span v-if="!item.url" class="lpName">{{item.name}}</span>
                <span class="lpWeight">
                    {{item.weight | displayWeight(item.authorUnit) }}
                    {{item.authorUnit}}
                </span>
                <span class="lpDescription">
                    {{item.description}}
                </span>
                <a class="lpRemove lpRemoveLibraryItem speedbump" title="Delete this item permanently" data-speedbump="removeItem"><i class="lpSprite lpSpriteRemove"></i></a>
                <div class="lpHandle" title="Reorder this item"></div>
            </li>
        </ul>
    </section>
</template>

<script>
import utilsMixin from "../mixins/utils-mixin.js";

export default {
    name: "libraryItem",
    mixins: [utilsMixin],
    props: ["item"],
    data: function() {
        return {
            searchText: ""
        };
    },
    computed: {
        library() {
            return this.$store.state.library;
        },
        filteredItems() {
            if (!this.searchText) {
                return this.library.items;
            } else {
                var filteredItems = [];
                for (var i in this.library.items) {
                    var item = this.library.items[i];
                    if (item.name.toLowerCase().indexOf(this.searchText) > -1 || item.description.toLowerCase().indexOf(this.searchText) > -1 ) {
                        filteredItems.push(item);
                    }
                }
                return filteredItems;
            }
        }
    }
}
</script>