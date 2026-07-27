<template>
    <div>
        <modal id="itemImageDialog" :shown="shown" @hide="$emit('hide')">
            <div class="columns">
                <div class="lpHalf">
                    <h2>Add image by URL</h2>
                    <form id="itemImageUrlForm" @submit.prevent="saveImageUrl()">
                        <div class="lpFields">
                            <input id="itemImageUrl" v-model="imageUrl" type="text" placeholder="Image URL">
                        </div>
                        <div class="lpButtons">
                            <input type="submit" class="lpButton" value="Save">
                            <a class="lpHref" @click="$emit('hide')">Cancel</a>
                        </div>
                    </form>
                </div>
                <div class="lpHalf">
                    <h2>Upload image from disk</h2>
                    <template v-if="item && !hasImage">
                        <div class="lpButtons">
                            <button id="itemImageUpload" class="lpButton" @click="triggerImageUpload">
                                Upload Image
                            </button>
                            <a class="lpHref" @click="$emit('hide')">Cancel</a>
                        </div>
                        <p v-if="uploading">
                            Uploading image...
                        </p>
                    </template>
                    <template v-if="item && hasImage">
                        <div class="lpButtons">
                            <button id="itemImageUpload" class="lpButton" @click="removeItemImage">
                                Remove Image
                            </button>
                        </div>
                    </template>
                </div>
            </div>
        </modal>
        <form id="imageUpload" ref="imageUploadForm">
            <input id="image" ref="imageInput" type="file" name="image" @change="uploadImage">
        </form>
    </div>
</template>

<script>
import modal from './modal.vue';
import { fetchJson } from '../utils/utils.js';

export default {
    name: 'ItemImage',
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
            imageUrl: null,
            uploading: false,
        };
    },
    computed: {
        hasImage() {
            return Boolean(this.item && (this.item.image || this.item.imageUrl));
        },
    },
    watch: {
        item(newItem) {
            this.imageUrl = newItem ? newItem.imageUrl : null;
        },
    },
    methods: {
        saveImageUrl() {
            this.$store.commit('updateItemImageUrl', { imageUrl: this.imageUrl, item: this.item });
            this.$emit('hide');
        },
        triggerImageUpload() {
            this.$refs.imageInput.click();
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

            if (name.length < 1) return;
            if (size > 5 * 1024 * 1024) {
                alert('Please upload a file less than 5mb');
                return;
            }
            if (type !== 'image/png' && type !== 'image/jpeg' && type !== 'image/webp') {
                alert('Please upload a JPEG, PNG, or WebP image.');
                return;
            }
            const formData = new FormData(this.$refs.imageUploadForm);
            this.uploading = true;

            return fetchJson('/imageUpload', {
                method: 'POST',
                body: formData,
                credentials: 'same-origin',
            })
                .then((response) => {
                    this.uploading = false;
                    this.$store.commit('updateItemImageUrl', { imageUrl: response.imageUrl, item: this.item });
                    this.$emit('hide');
                }).catch(() => {
                    this.uploading = false;
                    alert('Upload failed! If this issue persists please file a bug.');
                });
        },
        removeItemImage() {
            this.$store.commit('removeItemImage', this.item);
        },
    },
};
</script>

<style lang="scss">
@import "../css/_globals";

#itemImageDialog {
    // Two ways in, side by side, need more room than the stock dialog. Below
    // the phone breakpoint the columns stack and the modal's own full-width
    // rule takes over, so this stays out of the way rather than overflowing.
    @media only screen and (width > $mobile) {
        width: 640px;
    }

    .columns {
        display: flex;
    }

    // Floated halves were free to disagree about height. A flex row keeps them
    // equal, which is what lets the two actions below line up with each other.
    .lpHalf {
        display: flex;
        flex: 1;
        flex-direction: column;
        float: none;
        width: auto;
    }

    // Only the URL side has a field above its button, so pin both columns'
    // actions to the foot of the row instead of letting them float up.
    form {
        display: flex;
        flex-direction: column;
        flex-grow: 1;
    }

    form .lpButtons,
    .lpHalf > .lpButtons {
        margin-top: auto;
    }
}

@media only screen and (width <= $mobile) {
    #itemImageDialog {
        .columns {
            flex-direction: column;
            gap: $spacingLarge;
        }

        // The 20px gutter between side-by-side columns just indents them once
        // they are stacked; the gap above spaces them instead.
        .lpHalf {
            padding: 0;
        }
    }
}

</style>
