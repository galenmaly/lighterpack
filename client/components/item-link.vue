<template>
    <modal id="itemLinkDialog" :shown="shown" @hide="$emit('hide')">
        <h2>Add a link for this item</h2>
        <form id="itemLinkForm" @submit.prevent="addLink">
            <input v-model="url" type="text" d="itemLink" placeholder="Item Link">
            <input type="submit" class="lpButton" value="Save">
            <a class="lpHref close" @click="$emit('hide')">Cancel</a>
        </form>
    </modal>
</template>

<script>
import modal from './modal.vue';

export default {
    name: 'ItemLink',
    components: {
        modal,
    },
    props: {
        shown: {
            type: Boolean,
            required: true,
        },
        item: {
            type: Object,
            default: null,
        },
    },
    emits: ['hide'],
    data() {
        return {
            url: '',
        };
    },
    watch: {
        item(newItem) {
            this.url = newItem ? newItem.url : '';
        },
    },
    methods: {
        addLink() {
            this.$store.commit('updateItemLink', { url: this.url, item: this.item });
            this.$emit('hide');
        },
    },
};
</script>

<style lang="scss">

</style>
