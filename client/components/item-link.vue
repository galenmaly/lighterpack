<style lang="scss">

</style>

<template>
    <div v-if="shown">
        <div :class="'lpDialog ' + modalClasses" id="itemLinkDialog">
            <h2>Add a link for this item</h2>
            <form v-on:submit="addLink" id="itemLinkForm">
                <input v-model="url" type="text" d="itemLink" placeholder="Item Link"/>
                <input type="submit" class="lpButton" value="Save" />
                <a v-on:click="closeModal" class="lpHref close">Cancel</a>
            </form>
        </div>
        <div v-on:click="closeModal" :class="'lpModalOverlay ' + modalClasses"></div>
    </div>
</template>

<script>
const modalMixin = require("../mixins/modal-mixin.js");

export default {
    name: "item-link",
    mixins: [modalMixin],
    data: function() {
        return {
            url: "",
            item: false
        }
    },
    methods: {
        addLink: function() {
            this.$store.commit("updateItemLink", {url: this.url, item: this.item});
            this.closeModal();
        }
    },
    beforeMount: function() {
        bus.$on("updateItemLink", (item) => {
            this.openModal();
            this.item = item;
            this.url = item.url;
        });
    }
}
</script>