<template>
    <modal id="copyListDialog" :shown="shown" @hide="$emit('hide')">
        <h2>Choose the list to copy</h2>
        <div class="lpFields">
            <select id="listToCopy" v-model="listId">
                <option value="" disabled>
                    Select a list…
                </option>
                <option v-for="list in library.lists" :key="list.id" :value="list.id">
                    {{ listName(list) }}
                </option>
            </select>
        </div>
        <p class="lpWarning">
            <b>Note:</b> Copying a list will link the items between your lists. Updating an item in one list will alter that item in all other lists that item is in.
        </p>
        <div class="lpButtons">
            <a id="copyConfirm" class="lpButton" @click="copyList">Copy List</a>
            <a class="lpHref" @click="$emit('hide')">Cancel</a>
        </div>
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
            // Empty rather than false so it matches the placeholder option and
            // the select opens on a prompt instead of a blank row. Still falsy,
            // so copyList's guard reads the same.
            listId: '',
        };
    },
    computed: {
        library() {
            return this.$store.state.library;
        },
    },
    methods: {
        // Matches the lists rail: an unnamed list still needs something to
        // pick, or its option renders as a blank row.
        listName(list) {
            return list.name || 'New list';
        },
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

#copyListDialog {
    // The note is an aside between the picker and the actions, so it wants the
    // same breathing room on both sides rather than the tighter default the
    // modal gives a run of paragraphs.
    .lpWarning {
        margin: 0 0 $spacingMedium;
    }
}

</style>
