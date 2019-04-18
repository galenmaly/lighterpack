<style lang="scss">
@import "../css/_globals";

.warning {
    border: 1px solid #777;
    background: $yellow2;
    border-radius: 5px;
    padding: 10px;
}

</style>

<template>
    <modal :shown="shown" @hide="shown = false" id="copyListDialog">
        <h2>Choose the list to copy</h2>
        <select id="listToCopy" v-model="listId">
            <option v-for="list in library.lists" :value="list.id">{{list.name}}</option>
        </select>
        <br /><br />
        <p class="warning"><b>Note:</b> Copying a list will link the items between your lists. Updating an item in one list will alter that item in all other lists that item is in.</p>
        <a @click="copyList" class="lpButton" id="copyConfirm">Copy List</a>
        <a @click="shown = false" class="lpButton close">Cancel</a>
    </modal>
</template>

<script>
import modal from "./modal.vue";

export default {
    name: "copy-list",
    components: {
        modal
    },
    data: function() {
        return {
            listId: false,
            shown: false
        }
    },
    computed: {
        library: function() {
            return this.$store.state.library;
        }
    },
    methods: {
        copyList: function() {
            if (!this.listId) {
                return; //TODO: errors
            }
            this.$store.commit("copyList", this.listId);
            this.shown = false;
        }
    },
    beforeMount: function() {
        bus.$on("copyList", () => {
            this.shown = true;
        });
    }
}
</script>
