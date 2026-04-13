<style lang="scss">
#share label {
    font-weight: bold;
}
</style>

<template>
    <span v-if="isSignedIn" class="headerItem hasPopover">
        <PopoverHover id="share" @shown="focusShare">
            <template #target><span><i class="lpSprite lpLink" /> Share</span></template>
            <template #content>
                <div class="lpFields">
                    <div class="lpField">
                        <label for="shareUrl">Share your list</label>
                        <input id="shareUrl" ref="shareInput" v-select-on-focus type="text" :value="shareUrl">
                    </div>
                    <div class="lpField">
                        <label for="embedUrl">Embed your list</label>
                        <textarea id="embedUrl" v-select-on-focus>&lt;script src="{{ this.baseUrl }}/e/{{ this.externalId }}"&gt;&lt;/script&gt;&lt;div id="{{ this.externalId }}"&gt;&lt;/div&gt;</textarea>
                    </div>
                    <a id="csvUrl" :href="csvUrl" target="_blank" class="lpHref"><i class="lpSprite lpSpriteDownload" />Export to CSV</a>
                </div>
            </template>
        </PopoverHover>
    </span>
</template>

<script>
import PopoverHover from './popover-hover.vue';

export default {
    name: 'Share',
    components: {
        PopoverHover,
    },
    computed: {
        library() {
            return this.$store.state.library;
        },
        list() {
            return this.library.getListById(this.library.defaultListId);
        },
        isSignedIn() {
            return this.$store.state.loggedIn;
        },
        externalId() {
            return this.list.externalId || '';
        },
        baseUrl() {
            const location = window.location;
            return location.origin ? location.origin : `${location.protocol}//${location.hostname}`;
        },
        shareUrl() {
            if (this.externalId) {
                return `${this.baseUrl}/r/${this.externalId}`;
            }
            return '';
        },
        csvUrl() {
            if (this.externalId) {
                return `${this.baseUrl}/csv/${this.externalId}`;
            }
            return '';
        },
    },
    methods: {
        focusShare(evt) {
            const selectShareInput = () => {
                this.$nextTick(() => {
                    if (this.$refs.shareInput) this.$refs.shareInput.select();
                });
            };
            if (!this.list.externalId) {
                return fetchJson('/externalId', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'same-origin',
                })
                    .then((response) => {
                        this.$store.commit('setExternalId', { externalId: response.externalId, list: this.list });
                        selectShareInput();
                    })
                    .catch((response) => {
                        alert('An error occurred while attempting to get an ID for your list. Please try again later.'); // TODO
                    });
            }
            selectShareInput();
        },
    },
};
</script>
