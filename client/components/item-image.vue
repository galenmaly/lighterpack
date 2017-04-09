<style lang="scss">

</style>

<template>
    <div>
        <div v-if="shown" class="lpDialog" id="itemImageDialog">
            <div class="columns">
                <div class="lpHalf">
                    <h2>Add image by URL</h2>
                    <form id="itemImageUrlForm" v-on:submit="saveImageUrl($event)">
                        <input v-model="imageUrl" type="text" id="itemImageUrl" placeholder="Image URL"/>
                        <input type="submit" class="lpButton" value="Save" />
                        <a v-on:click="closeModal" class="lpHref close">Cancel</a>
                    </form>
                </div>
                <div class="lpHalf">
                    <h2>Upload image from disk</h2>
                    <p class="imageUploadDescription">Your image will be hosted on imgur.</p>
                    <button v-on:click="triggerImageUpload" class="lpButton" id="itemImageUpload">Upload Image</button>
                    <a href="#" class="lpHref close">Cancel</a>
                    <p id="uploadingText" style="display:none;">Uploading image...</p>

                    
                </div>
            </div>
        </div>
        <div v-if="shown" v-on:click="closeModal" class="lpModalOverlay"></div>
        <form id="imageUpload">
            <input type="file" name="image" id="image" />
        </form>
    </div>
</template>

<script>
const modalMixin = require("../mixins/modal-mixin.js");

export default {
    name: "item-image",
    mixins: [modalMixin],
    data: function() {
        return {
            imageInput: false,
            item: false
        }
    },
    methods: {
        saveImageUrl: function(evt) {
            evt.preventDefault();
            this.$store.commit("updateItemImageUrl", {imageUrl: this.imageUrl, item: this.item});
            this.closeModal();
        },
        triggerImageUpload: function() {
            this.imageInput.click();
        }
    },
    mounted: function() {
        this.imageInput = document.getElementById("image");
        this.imageInput.onchange = this.uploadImage;


        bus.$on("updateItemImage", (item) => {
            this.openModal();
            this.item = item;
            this.imageUrl = item.imageUrl;
        });
    }
}
</script>