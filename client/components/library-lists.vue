<style lang="scss">
</style>

<template>
    <section id="listContainer">
        <h2>Lists</h2>
        <span id="addListFlyout" class="lpFlyout">
            <span class="lpTarget"><a id="addList" class="lpAdd" v-on:click="newList"><i class="lpSprite lpSpriteAdd"></i>Add new list</a></span>
            <div class="lpContent">
                <div><a v-on:click="importCSV" id="importList" class="lpAdd"><i class="lpSprite lpSpriteUpload"></i>Import CSV</a></div>
                <div><a v-on:click="copyList" sid="copyList" class="lpCopy"><i class="lpSprite lpSpriteCopy"></i>Copy a list</a></div>
            </div>
        </span>
           
        <ul id="lists">
            <li v-for="list in library.lists" class="lpLibraryList" :class="{lpActive: (library.defaultListId == list.id)}">
                <span class='lpLibraryListSwitch lpListName' v-on:click="setDefaultList(list)">
                    {{list | listName}}
                </span>
                <a class='lpRemove speedbump' title="Remove this list" data-speedbump="removeList"><i class="lpSprite lpSpriteRemove"></i></a>
            </li>
        </ul>
    </section>
    
</template>

<script>

export default {
    name: "libraryItem",
    props: ["list"],
    computed: {
        library() {
            return this.$store.state.library;
        }
    },
    filters: {
        listName: function (list) {
            return list.name || "New list";
        }
    },
    methods: {
        setDefaultList: function(list) {
            this.$store.commit("setDefaultList", list);
        },
        newList: function() {
            this.$store.commit("newList");
        },
        copyList: function() {
            bus.$emit("copyList");
        },
        importCSV: function() {
            bus.$emit("importCSV");
        }
    }
}
</script>