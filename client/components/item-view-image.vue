<style lang="scss">

#itemImageDialog {
    width: 640px;

    .imageUploadDescription {
        margin-bottom: 19px;
    }
}

</style>

<template>
    <modal :shown="shown" @hide="shown = false" id="lpImageDialog">
        <img :src="imageUrl" />
    </modal>
</template>

<script>
import modal from "./modal.vue";

export default {
    name: "item-view-image",
    components: {
        modal
    },
    data: function() {
        return {
            imageUrl: "",
            shown: false
        };
    },
    mounted: function() {
        bus.$on("viewItemImage", (imageUrl) => {
            this.shown = true;
            this.imageUrl = imageUrl;
        });
    }
}
</script>