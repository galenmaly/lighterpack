<style lang="scss">

</style>

<template>
    <div>
        <div v-if="shown" :class="'lpDialog ' + modalClasses" id="lpImageDialog">
            <img :src="imageUrl" />
        </div>
        <div v-if="shown" v-on:click="closeModal" :class="'lpModalOverlay ' + modalClasses"></div>
    </div>
</template>

<script>
const modalMixin = require("../mixins/modal-mixin.js");

export default {
    name: "item-view-image",
    mixins: [modalMixin],
    data: function() {
        return {
            imageUrl: ""
        };
    },
    mounted: function() {
        bus.$on("viewItemImage", (imageUrl) => {
            this.openModal();
            this.imageUrl = imageUrl;
        });
    }
}
</script>