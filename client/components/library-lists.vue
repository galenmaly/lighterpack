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
                <div class="lpHandle" title="Reorder this item"></div>
                <span class='lpLibraryListSwitch lpListName' v-on:click="setDefaultList(list)">
                    {{list | listName}}
                </span>
                <a v-on:click="removeList(list)" class="lpRemove" title="Remove this list"><i class="lpSprite lpSpriteRemove"></i></a>
            </li>
        </ul>
    </section>
    
</template>

<script>
const dragula = require("dragula");

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
        },
        handleListReorder: function() {
            var $lists = document.getElementById("lists");
            var drake = dragula([$lists], {
                moves: function ($el, $source, $handle, $sibling) {
                    return $handle.classList.contains("lpHandle");
                }
            });
            drake.on("drag", ($el, $target, $source, $sibling) => {
                this.dragStartIndex = getElementIndex($el);
            });
            drake.on("drop", ($el, $target, $source, $sibling) => {
                this.$store.commit("reorderList", {before: this.dragStartIndex, after: getElementIndex($el)});
                drake.cancel(true);
            });
        },
        removeList: function(list) {
            var callback = function() {
                this.$store.commit("removeList", list);
            };
            var speedbumpOptions = {
                body: "Are you sure you want to delete this list? This cannot be undone."
            };
            bus.$emit("initSpeedbump", callback, speedbumpOptions);
        }
    },
    mounted: function() {
        this.handleListReorder();
    }
}
</script>