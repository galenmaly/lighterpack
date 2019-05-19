<style lang="scss">

</style>

<template>
    <div>
        <modal id="itemImageDialog" :shown="shown" @hide="shown = false">
            <div class="columns">
                <div class="lpHalf">
                    <h2>Add image by URL</h2>
                    <form id="itemImageUrlForm" @submit.prevent="saveImageUrl()">
                        <input id="itemImageUrl" v-model="imageUrl" type="text" placeholder="Image URL">
                        <input type="submit" class="lpButton" value="Save">
                        <a class="lpHref close" @click="shown = false">Cancel</a>
                    </form>
                </div>
                <div class="lpHalf">
                    <h2>Upload image from disk</h2>
                    <template v-if="!item.image">
                        <p class="imageUploadDescription">
                            Your image will be hosted on imgur.
                        </p>
                        <button id="itemImageUpload" class="lpButton" @click="triggerImageUpload">
                            Upload Image
                        </button>
                        <a class="lpHref close" @click="shown = false">Cancel</a>
                        <p v-if="uploading">
                            Uploading image...
                        </p>
                    </template>
                    <template v-if="item.image">
                        <button id="itemImageUpload" class="lpButton" @click="removeItemImage">
                            Remove Image
                        </button>
                    </template>
                </div>
            </div>
        </modal>
        <form id="imageUpload">
            <input id="image" type="file" name="image">
        </form>
    </div>
</template>

<script>
import modal from './modal.vue';

export default {
    name: 'ItemImage',
    components: {
        modal,
    },
    data() {
        return {
            imageUrl: null,
            imageInput: false,
            item: false,
            uploading: false,
            shown: false,
        };
    },
    mounted() {
        this.imageInput = document.getElementById('image');
        this.imageInput.onchange = this.uploadImage;


        bus.$on('updateItemImage', (item) => {
            this.shown = true;
            this.item = item;
            this.imageUrl = item.imageUrl;
        });
    },
    methods: {
        saveImageUrl() {
            this.$store.commit('updateItemImageUrl', { imageUrl: this.imageUrl, item: this.item });
            this.shown = false;
        },
        triggerImageUpload() {
            this.imageInput.click();
        },
        uploadImage(evt) {
            if (!FormData) {
                alert('Your browser is not supported for file uploads. Please update to a more modern browser.');
                return;
            }
            const file = evt.target.files[0];
            const name = file.name;
            const size = file.size;
            const type = file.type;

            if (name.length < 1) {
                return;
            }
            if (size > 2500000) {
                alert('Please upload a file less than 2.5mb');
                return;
            }
            if (type != 'image/png' && type != 'image/jpg' && !type != 'image/gif' && type != 'image/jpeg') {
                alert('File doesnt match png, jpg or gif.');
                return;
            }
            const formData = new FormData(document.getElementById('imageUpload'));

            this.uploading = true;

            return fetchJson('/imageUpload', {
                method: 'POST',
                body: formData,
                credentials: 'same-origin',
            })
                .then((response) => {
                    this.uploading = false;
                    this.$store.commit('updateItemImage', { image: response.data.id, item: this.item });
                    this.shown = false;
                }).catch((response) => {
                    this.uploading = false;
                    alert('Upload failed! If this issue persists please file a bug.');
                });
        },
        removeItemImage() {
            this.$store.commit('removeItemImage', this.item);
            this.item.image = '';
        },
    },
};
</script>
