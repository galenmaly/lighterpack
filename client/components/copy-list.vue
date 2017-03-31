<style lang="scss">

</style>

<template>
    <div v-if="shown">
        <div class="lpDialog" id="copyListDialog">
            <h2>Choose the list to copy</h2>
            <select id="listToCopy" v-model="listId">
                <option v-for="list in library.lists" :value="list.id">{{list.name}}</option>
            </select>
            <br /><br />
            <p class="warning"><b>Note:</b> Copying a list will link the items between your lists. Updating an item in one list will alter that item in all other lists that item is in.</p>
            <a v-on:click="copyList" class="lpButton" id="copyConfirm">Copy List</a>
            <a v-on:click="closeModal" class="lpButton close">Cancel</a>
        </div>
        <div v-on:click="closeModal" class="lpModalOverlay"></div>
    </div>
</template>

<script>
const modalMixin = require("../mixins/modal-mixin.js");

export default {
    name: "copy-list",
    mixins: [modalMixin],
    data: function() {
        return {
            listId: false
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
            this.closeModal();
        }
    },
    beforeMount: function() {
        bus.$on("copyList", () => {
            this.openModal();
        });
    }
}
</script>
