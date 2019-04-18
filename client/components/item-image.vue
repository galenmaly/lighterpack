<style lang="scss">

</style>

<template>
    <div>
        <modal :shown="shown" @hide="shown = false" id="itemImageDialog">
            <div class="columns">
                <div class="lpHalf">
                    <h2>Add image by URL</h2>
                    <form id="itemImageUrlForm" @submit.prevent="saveImageUrl()">
                        <input v-model="imageUrl" type="text" id="itemImageUrl" placeholder="Image URL"/>
                        <input type="submit" class="lpButton" value="Save" />
                        <a @click="shown = false" class="lpHref close">Cancel</a>
                    </form>
                </div>
                <div class="lpHalf">
                    <h2>Upload image from disk</h2>
                    <template v-if="!item.image">
                        <p class="imageUploadDescription">Your image will be hosted on imgur.</p>
                        <button @click="triggerImageUpload" class="lpButton" id="itemImageUpload">Upload Image</button>
                        <a @click="shown = false" class="lpHref close">Cancel</a>
                        <p v-if="uploading">Uploading image...</p>
                    </template>
                    <template v-if="item.image">
                        <button @click="removeItemImage" class="lpButton" id="itemImageUpload">Remove Image</button>
                    </template>
                </div>
            </div>
        </modal>
        <form id="imageUpload">
            <input type="file" name="image" id="image" />
        </form>
    </div>
</template>

<script>
import modal from "./modal.vue";

export default {
    name: "item-image",
    components: {
        modal
    },
    data: function() {
        return {
            imageUrl: null,
            imageInput: false,
            item: false,
            uploading: false,
            shown: false
        }
    },
    methods: {
        saveImageUrl: function() {
            this.$store.commit("updateItemImageUrl", {imageUrl: this.imageUrl, item: this.item});
            this.shown = false;
        },
        triggerImageUpload: function() {
            this.imageInput.click();
        },
        uploadImage: function(evt) {
            if (!FormData) {
                alert("Your browser is not supported for file uploads. Please update to a more modern browser.");
                return;
            }
            var file = evt.target.files[0];
            var name = file.name;
            var size = file.size;
            var type = file.type;

            if (name.length < 1) {
                return;
            }
            else if (size > 2500000) {
                alert("Please upload a file less than 2.5mb");
                return;
            }
            else if(type != 'image/png' && type != 'image/jpg' && !type != 'image/gif' && type != 'image/jpeg' ) {
                alert("File doesnt match png, jpg or gif.");
                return;
            }
            var formData = new FormData(document.getElementById("imageUpload"));

            this.uploading = true;

            return fetchJson("/imageUpload", {
                method: "POST",
                body:  formData,
                credentials: 'same-origin',
            })
            .then((response) => {
                this.uploading = false;
                this.$store.commit("updateItemImage", {image: response.data.id, item: this.item});
                this.shown = false;
            }).catch((response) => {
                this.uploading = false;
                alert("Upload failed! If this issue persists please file a bug.");
            });
        },
        removeItemImage: function() {
            this.$store.commit("removeItemImage", this.item);
            this.item.image = "";
        }
    },
    mounted: function() {
        this.imageInput = document.getElementById("image");
        this.imageInput.onchange = this.uploadImage;


        bus.$on("updateItemImage", (item) => {
            this.shown = true;
            this.item = item;
            this.imageUrl = item.imageUrl;
        });
    }
}
</script>