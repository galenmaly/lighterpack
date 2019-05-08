<style lang="scss">

</style>

<template>
    <modal :shown="shown" @hide="shown = false" id="itemLinkDialog">
        <h2>Add a link for this item</h2>
        <form @submit="addLink" id="itemLinkForm">
            <input v-model="url" type="text" d="itemLink" placeholder="Item Link"/>
            <input type="submit" class="lpButton" value="Save" />
            <a @click="shown = false" class="lpHref close">Cancel</a>
        </form>
    </modal>
</template>

<script>
import modal from "./modal.vue";

export default {
    name: "item-link",
    components: {
        modal
    },
    data: function() {
        return {
            url: "",
            item: false,
            shown: false
        }
    },
    methods: {
        addLink: function(e) {
            e.preventDefault();
            this.$store.commit("updateItemLink", {url: this.url, item: this.item});
            this.shown = false;
        }
    },
    beforeMount: function() {
        bus.$on("updateItemLink", (item) => {
            this.shown = true;
            this.item = item;
            this.url = item.url;
        });
    }
}
</script>