<template>
    <modal id="copyListDialog" :shown="shown" @hide="$emit('hide')">
        <h2>Choose the list to copy</h2>
        <select id="listToCopy" v-model="listId">
            <option v-for="list in library.lists" :key="list.id" :value="list.id">
                {{ list.name }}
            </option>
        </select>
        <br><br>
        <p class="lpWarning">
            <b>Note:</b> Copying a list will link the items between your lists. Updating an item in one list will alter that item in all other lists that item is in.
        </p>
        <a id="copyConfirm" class="lpButton" @click="copyList">Copy List</a>
        <a class="lpButton close" @click="$emit('hide')">Cancel</a>
    </modal>
</template>

<script>
import modal from './modal.vue';

export default {
    name: 'CopyList',
    components: {
        modal,
    },
    props: {
        shown: {
            type: Boolean,
            required: true,
        },
    },
    emits: ['hide'],
    data() {
        return {
            listId: false,
        };
    },
    computed: {
        library() {
            return this.$store.state.library;
        },
    },
    methods: {
        copyList() {
            if (!this.listId) return;
            this.$store.commit('copyList', this.listId);
            this.$emit('hide');
        },
    },
};
</script>

<style lang="scss">
@import "../css/_globals";

</style>
