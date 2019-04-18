<style lang="scss">

</style>

<template>
  <span
    v-if="isSignedIn"
    class="headerItem hasFlyout"
  >
    <span
      id="share"
      class="lpFlyout"
      @mouseenter="focusShare"
    >
      <span class="lpTarget"><i class="lpSprite lpLink" /> Share</span>
      <div class="lpContent">
        <h3>Share your list</h3>
        <input
          id="shareUrl"
          v-select-on-bus="'show-share-box'"
          type="text"
          :value="shareUrl"
        >
        <h3>Embed your list</h3>
        <textarea
          id="embedUrl"
          v-select-on-focus
        >&lt;script src="{{ this.baseUrl }}/e/{{ this.externalId }}"&gt;&lt;/script&gt;&lt;div id="{{ this.externalId }}"&gt;&lt;/div&gt;</textarea>
        <a
          id="csvUrl"
          :href="csvUrl"
          target="_blank"
          class="lpHref"
        ><i class="lpSprite lpSpriteDownload" />Export to CSV</a>
      </div>
    </span>
  </span>
</template>

<script>

export default {
    name: 'Share',
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
            const { location } = window;
            return location.origin ? location.origin : `${location.protocol}//${location.hostname}`;
        },
        shareUrl() {
            return `${this.baseUrl}/r/${this.externalId}`;
        },
        csvUrl() {
            return `${this.baseUrl}/csv/${this.externalId}`;
        },
    },
    methods: {
        focusShare(evt) {
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
                        setTimeout(() => {
                            bus.$emit('show-share-box');
                        }, 0);
                    })
                    .catch((response) => {
                        alert('An error occurred while attempting to get an ID for your list. Please try again later.'); // TODO
                    });
            }
            bus.$emit('show-share-box');
        },
    },
};
</script>
