<style lang="scss">

</style>

<template>
    <div>
        <div v-if="shown" :class="'lpDialog ' + modalClasses" id="itemImageDialog">
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
                    <a v-on:click="closeModal" class="lpHref close">Cancel</a>
                    <p v-if="uploading">Uploading image...</p>

                    
                </div>
            </div>
        </div>
        <div v-if="shown" v-on:click="closeModal" :class="'lpModalOverlay ' + modalClasses"></div>
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
            item: false,
            uploading: false
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
                this.closeModal();
            }).catch((response) => {
                this.uploading = false;
                alert("Upload failed! If this issue persists please file a bug.");
            });
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